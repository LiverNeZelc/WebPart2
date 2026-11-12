'use strict';

const crypto = require('node:crypto');
const { WebSocket, WebSocketServer } = require('ws');

const objectIdPattern = /^[a-f\d]{24}$/i;
const maxProgressValues = 64;
const maxChatMessageLength = 500;

module.exports = (server, Algorithm, User, verifyAccessToken) => {
    const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 16384 });
    const clients = new WeakMap();
    const rooms = new Map();
    const challenges = new Map();
    const clientsByUser = new Map();

    const send = (client, message) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    };

    const sendToUser = (userId, message) => {
        for (const client of clientsByUser.get(userId) || []) {
            send(client, message);
        }
    };

    const removeChallenge = (challengeId) => {
        const challenge = challenges.get(challengeId);
        if (!challenge) return null;
        clearTimeout(challenge.timeout);
        challenges.delete(challengeId);
        const state = clients.get(challenge.client);
        if (state) state.challengeId = null;
        return challenge;
    };

    const cancelChallenge = (challengeId, type) => {
        const challenge = removeChallenge(challengeId);
        if (!challenge) return;
        sendToUser(challenge.targetUserId, { type, challengeId });
    };

    const disconnectFromRoom = (client) => {
        const state = clients.get(client);
        if (!state?.roomId) return;

        const room = rooms.get(state.roomId);
        state.roomId = null;
        if (!room) return;

        const other = room.members.find((member) => member !== client);
        if (other) send(other, { type: 'opponent-disconnected' });
        rooms.delete(room.id);
        for (const member of room.members) {
            const memberState = clients.get(member);
            if (memberState) memberState.roomId = null;
        }
    };

    const sendError = (client, message) => send(client, { type: 'error', message });

    const createRoom = (firstClient, secondClient, firstAlgorithm, secondAlgorithm) => {
        const room = {
            id: crypto.randomUUID(),
            members: [firstClient, secondClient],
            ready: new Set(),
            started: false,
            values: Array.from({ length: 32 }, () => crypto.randomInt(10, 100))
        };
        rooms.set(room.id, room);

        const participants = [
            { client: firstClient, algorithm: firstAlgorithm },
            { client: secondClient, algorithm: secondAlgorithm }
        ].map(({ client, algorithm }) => {
            const state = clients.get(client);
            state.roomId = room.id;
            return {
                userId: state.user.userId,
                username: state.user.username,
                algorithmId: algorithm._id.toString(),
                algorithmName: algorithm.name
            };
        });

        for (const client of room.members) {
            send(client, {
                type: 'matched',
                roomId: room.id,
                participants,
                values: room.values
            });
        }
    };

    const joinQueue = async (client, message) => {
        const state = clients.get(client);
        if (state.roomId || state.challengeId || state.joining) {
            return sendError(client, 'Вы уже отправили приглашение или участвуете в соревновании');
        }
        if (!objectIdPattern.test(message.algorithmId || '')
            || !objectIdPattern.test(message.referenceAlgorithmId || '')) {
            return sendError(client, 'Выберите корректные алгоритмы сортировки');
        }

        state.joining = true;
        try {
            const [algorithm, reference] = await Promise.all([
                Algorithm.findOne({
                    _id: message.algorithmId,
                    owner_id: state.user.userId,
                    type: 'Сортировка',
                    is_public: true,
                    python_code: { $ne: '' }
                }).lean(),
                Algorithm.findOne({
                    _id: message.referenceAlgorithmId,
                    type: 'Сортировка',
                    is_public: true,
                    python_code: { $ne: '' }
                }).lean()
            ]);
            if (!algorithm || !algorithm.python_code?.trim()) {
                return sendError(client, 'Ваш алгоритм должен быть опубликован и содержать код Python');
            }
            if (!reference) {
                return sendError(client, 'Публичный алгоритм сортировки больше недоступен');
            }

            const algorithmId = algorithm._id.toString();
            const referenceId = reference._id.toString();
            if (algorithmId === referenceId) {
                return sendError(client, 'Выберите две разные публичные сортировки');
            }
            if (reference.owner_id === state.user.userId) {
                return sendError(client, 'Выберите публичную сортировку другого пользователя');
            }

            const targetClients = clientsByUser.get(reference.owner_id);
            if (!targetClients || ![...targetClients].some((target) => (
                target.readyState === WebSocket.OPEN && clients.get(target)?.user
            ))) {
                return sendError(client, 'Владелец сортировки сейчас не в сети');
            }

            const challengeId = crypto.randomUUID();
            state.challengeId = challengeId;
            state.algorithmId = algorithmId;
            const challenge = {
                id: challengeId,
                client,
                challengerUserId: state.user.userId,
                targetUserId: reference.owner_id,
                algorithmId,
                algorithmName: algorithm.name,
                targetAlgorithmId: referenceId,
                targetAlgorithmName: reference.name,
                accepting: false,
                timeout: null
            };
            challenge.timeout = setTimeout(() => {
                const expired = removeChallenge(challengeId);
                if (!expired) return;
                send(expired.client, { type: 'challenge-expired', challengeId });
                sendToUser(expired.targetUserId, { type: 'challenge-expired', challengeId });
            }, 120000);
            challenges.set(challengeId, challenge);
            send(client, { type: 'waiting', challengeId, username: reference.name });
            sendToUser(reference.owner_id, {
                type: 'challenge',
                challengeId,
                challengerName: state.user.username,
                algorithmId,
                algorithmName: algorithm.name,
                targetAlgorithmId: referenceId,
                targetAlgorithmName: reference.name
            });
        } finally {
            state.joining = false;
        }
    };

    const acceptChallenge = async (client, challengeId) => {
        const state = clients.get(client);
        const challenge = challenges.get(challengeId);
        if (state.roomId || state.joining) {
            return sendError(client, 'Сначала завершите текущее соревнование');
        }
        if (!challenge || challenge.targetUserId !== state.user.userId || challenge.accepting) {
            return sendError(client, 'Это приглашение уже недоступно');
        }
        if (challenge.client.readyState !== WebSocket.OPEN || clients.get(challenge.client)?.roomId) {
            cancelChallenge(challengeId, 'challenge-expired');
            return sendError(client, 'Инициатор соревнования больше не в сети');
        }

        challenge.accepting = true;
        state.joining = true;
        try {
            const [challengerAlgorithm, targetAlgorithm] = await Promise.all([
                Algorithm.findOne({
                    _id: challenge.algorithmId,
                    owner_id: challenge.challengerUserId,
                    type: 'Сортировка',
                    is_public: true,
                    python_code: { $ne: '' }
                }).lean(),
                Algorithm.findOne({
                    _id: challenge.targetAlgorithmId,
                    owner_id: state.user.userId,
                    type: 'Сортировка',
                    is_public: true,
                    python_code: { $ne: '' }
                }).lean()
            ]);

            if (!challengerAlgorithm || !targetAlgorithm
                || challenge.client.readyState !== WebSocket.OPEN
                || challenges.get(challengeId) !== challenge) {
                cancelChallenge(challengeId, 'challenge-expired');
                return sendError(client, 'Алгоритм больше недоступен. Приглашение отменено.');
            }

            removeChallenge(challengeId);
            for (const otherChallenge of [...challenges.values()]) {
                if (otherChallenge.targetUserId === state.user.userId) {
                    removeChallenge(otherChallenge.id);
                    send(otherChallenge.client, {
                        type: 'challenge-cancelled',
                        challengeId: otherChallenge.id
                    });
                }
            }
            createRoom(challenge.client, client, challengerAlgorithm, targetAlgorithm);
        } finally {
            state.joining = false;
        }
    };

    const handleMessage = async (client, rawMessage) => {
        const state = clients.get(client);
        let message;
        try {
            message = JSON.parse(rawMessage.toString());
        } catch {
            return sendError(client, 'Получено некорректное сообщение');
        }
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return sendError(client, 'Получено некорректное сообщение');
        }

        if (!state.user) {
            if (message.type !== 'authenticate' || typeof message.token !== 'string') {
                client.close(1008, 'Authentication required');
                return;
            }
            try {
                const payload = verifyAccessToken(message.token);
                const user = await User.findByPk(payload.userId);
                if (!user) throw new Error('Пользователь не найден');
                state.user = { userId: user.id, username: user.username };
                if (!clientsByUser.has(user.id)) clientsByUser.set(user.id, new Set());
                clientsByUser.get(user.id).add(client);
                send(client, { type: 'authenticated' });
            } catch {
                client.close(1008, 'Invalid access token');
            }
            return;
        }

        if (message.type === 'join') {
            try {
                await joinQueue(client, message);
            } catch (error) {
                console.error('Failed to join sorting competition:', error);
                sendError(client, 'Не удалось подключиться к соревнованию');
            }
            return;
        }

        if (message.type === 'accept-challenge') {
            try {
                await acceptChallenge(client, message.challengeId);
            } catch (error) {
                console.error('Failed to accept sorting challenge:', error);
                const challenge = challenges.get(message.challengeId);
                if (challenge) challenge.accepting = false;
                state.joining = false;
                sendError(client, 'Не удалось принять приглашение');
            }
            return;
        }

        if (message.type === 'decline-challenge') {
            const challenge = challenges.get(message.challengeId);
            if (!challenge || challenge.targetUserId !== state.user.userId || challenge.accepting) {
                return sendError(client, 'Это приглашение уже недоступно');
            }
            removeChallenge(message.challengeId);
            send(challenge.client, {
                type: 'challenge-declined',
                challengeId: challenge.id,
                username: state.user.username
            });
            sendToUser(challenge.targetUserId, { type: 'challenge-removed', challengeId: challenge.id });
            return;
        }

        if (message.type === 'cancel-challenge') {
            const challenge = challenges.get(message.challengeId);
            if (!challenge || challenge.client !== client || challenge.accepting) {
                return sendError(client, 'Приглашение уже недоступно');
            }
            cancelChallenge(message.challengeId, 'challenge-cancelled');
            return;
        }

        if (message.type === 'leave') {
            disconnectFromRoom(client);
            return;
        }

        const room = state.roomId ? rooms.get(state.roomId) : null;
        if (!room || !room.members.includes(client)) {
            return sendError(client, 'Сначала подключитесь к соревнованию');
        }

        if (message.type === 'ready') {
            if (room.started) return;
            room.ready.add(client);
            for (const member of room.members) {
                send(member, { type: 'ready-count', count: room.ready.size, total: room.members.length });
            }
            if (room.ready.size === room.members.length) {
                room.started = true;
                for (const member of room.members) {
                    send(member, { type: 'start', roomId: room.id, values: room.values });
                }
            }
            return;
        }

        if (message.type === 'chat') {
            if (typeof message.text !== 'string' || message.text.trim() === ''
                || message.text.trim().length > maxChatMessageLength) {
                return sendError(client, `Сообщение чата должно содержать от 1 до ${maxChatMessageLength} символов`);
            }
            const chatMessage = {
                type: 'chat',
                userId: state.user.userId,
                username: state.user.username,
                text: message.text.trim(),
                sentAt: new Date().toISOString()
            };
            for (const member of room.members) send(member, chatMessage);
            return;
        }

        if (!room.started) return sendError(client, 'Ожидайте готовности обоих участников');
        if (message.type === 'progress') {
            if (!Array.isArray(message.values) || message.values.length !== room.values.length
                || message.values.length > maxProgressValues
                || !message.values.every((value) => Number.isInteger(value) && value >= 10 && value < 100)) {
                return sendError(client, 'Некорректный шаг сортировки');
            }
            const senderId = state.user.userId;
            for (const member of room.members) {
                if (member !== client) {
                    send(member, { type: 'progress', senderId, values: message.values });
                }
            }
            return;
        }

        if (message.type === 'complete') {
            if (typeof message.elapsed !== 'number' || !Number.isFinite(message.elapsed)
                || message.elapsed < 0 || message.elapsed > 600000) {
                return sendError(client, 'Некорректный результат сортировки');
            }
            const senderId = state.user.userId;
            for (const member of room.members) {
                send(member, { type: 'complete', senderId, elapsed: message.elapsed });
            }
            return;
        }

        if (message.type === 'failed') {
            const senderId = state.user.userId;
            for (const member of room.members) {
                send(member, { type: 'failed', senderId });
            }
        }
    };

    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (pathname !== '/ws/sort') {
            socket.destroy();
            return;
        }
        websocketServer.handleUpgrade(request, socket, head, (client) => {
            websocketServer.emit('connection', client);
        });
    });

    websocketServer.on('connection', (client) => {
        clients.set(client, {
            user: null,
            challengeId: null,
            roomId: null,
            joining: false,
        });
        const authenticationTimeout = setTimeout(() => {
            if (!clients.get(client).user) client.close(1008, 'Authentication timeout');
        }, 5000);

        client.on('message', (message) => {
            handleMessage(client, message).catch((error) => {
                console.error('Sorting competition message failed:', error);
                sendError(client, 'Не удалось обработать сообщение');
            });
        });
        client.on('close', () => {
            clearTimeout(authenticationTimeout);
            const state = clients.get(client);
            if (state.challengeId) cancelChallenge(state.challengeId, 'challenge-cancelled');
            if (state.user) {
                const userClients = clientsByUser.get(state.user.userId);
                userClients?.delete(client);
                if (userClients?.size === 0) {
                    clientsByUser.delete(state.user.userId);
                    for (const challenge of challenges.values()) {
                        if (challenge.targetUserId === state.user.userId) {
                            send(challenge.client, {
                                type: 'challenge-expired',
                                challengeId: challenge.id
                            });
                            removeChallenge(challenge.id);
                        }
                    }
                }
            }
            disconnectFromRoom(client);
        });
        client.on('error', (error) => {
            console.error('Sorting competition WebSocket error:', error);
        });
    });

    return websocketServer;
};

'use strict';

const fs = require('fs');
const path = require('path');

const noop = () => {};
const idOf = (stat) => process.platform === 'win32'
    ? String(stat.ino)
    : `${stat.dev}:${stat.ino}`;


function createFileLogger(filePath, options = {}) {
    const maxQueueSize = options.maxQueueSize ?? 5000;           // сколько строк держать в памяти при сбоях
    const maxFileSize = options.maxFileSize ?? 5 * 1024 * 1024;  // порог ротации, байт
    const maxBackups = options.maxBackups ?? 3;                  // сколько старых файлов хранить
    const retryDelayMin = options.retryDelayMs ?? 1000;
    const retryDelayMax = options.maxRetryDelayMs ?? 30000;
    const onError = options.onError ?? ((message, error) => {
        console.error(`[logger] ${message}${error ? `: ${error.code || error.message}` : ''}`);
    });
    const onReady = options.onReady ?? noop;

    const dir = path.dirname(filePath);

    let stream = null;       // текущий WriteStream
    let ready = false;       // поток открыт и fileId известен
    let fileId = null;       // dev:ino открытого файла
    let fileSize = 0;        // текущий размер файла
    let opening = false;     // идёт создание каталога
    let writing = false;     // идёт проверка/запись пачки
    let rotating = false;
    let closing = false;
    let queue = [];
    let dropped = 0;         // сколько строк выброшено из-за переполнения очереди
    let retryDelay = retryDelayMin;
    let retryTimer = null;
    let noRotateUntil = 0;

    function trimQueue() {
        while (queue.length > maxQueueSize) {
            queue.shift();
            dropped++;
        }
    }

    function scheduleRetry() {
        if (retryTimer || closing) {
            return;
        }

        retryTimer = setTimeout(() => {
            retryTimer = null;
            open();
        }, retryDelay);
        retryTimer.unref();
        retryDelay = Math.min(retryDelay * 2, retryDelayMax);
    }

    function handleStreamError(failed, error) {
        if (stream !== failed) {
            return; // ошибка уже обработана или поток заменён
        }

        onError('ошибка файла лога', error);
        stream = null;
        ready = false;
        failed.destroy();
        scheduleRetry();
    }

    function open() {
        if (stream || opening || rotating || closing) {
            return;
        }

        opening = true;
        fs.mkdir(dir, { recursive: true }, (mkdirError) => {
            opening = false;

            if (closing) {
                return;
            }

            if (mkdirError) {
                onError('не удалось создать каталог логов', mkdirError);
                return scheduleRetry();
            }

            let current;

            try {
                current = fs.createWriteStream(filePath, { flags: 'a' });
            } catch (error) {
                onError('не удалось открыть файл лога', error);
                return scheduleRetry();
            }

            stream = current;
            ready = false;
            current.on('error', (error) => handleStreamError(current, error));
            current.once('open', (fd) => {
                fs.fstat(fd, { bigint: true }, (statError, stat) => {
                    if (stream !== current) {
                        return;
                    }

                    if (statError) {
                        return handleStreamError(current, statError);
                    }

                    fileId = idOf(stat);
                    fileSize = Number(stat.size);
                    ready = true;
                    retryDelay = retryDelayMin;
                    onReady();
                    flush();
                });
            });
        });
    }

    // Файл по пути всё ещё тот же, что мы открыли? (нет, если его удалили, переименовали или заменили)
    function verifyFile(callback) {
        fs.stat(filePath, { bigint: true }, (error, stat) => {
            if (error) {
                return callback(error.code === 'ENOENT' ? null : error);
            }

            callback(null, idOf(stat) === fileId);
        });
    }

    function reopen() {
        const old = stream;

        stream = null;
        ready = false;

        if (old) {
            old.removeAllListeners('error');
            old.on('error', noop);
            old.end();
        }

        open();
    }

    function flush() {
        if (!stream || !ready || writing || rotating || queue.length === 0) {
            return;
        }

        writing = true;
        verifyFile((error, same) => {
            const target = stream;

            if (error) {
                writing = false;
                return handleStreamError(target, error);
            }

            if (!same) {
                writing = false;
                return reopen();
            }

            if (!target || !ready) {
                writing = false;
                return;
            }

            const batch = queue;
            queue = [];

            if (dropped > 0) {
                batch.unshift(`${new Date().toISOString()} [logger] потеряно записей: ${dropped}\n`);
                dropped = 0;
            }

            const data = batch.join('');

            target.write(data, (error) => {
                if (error) {
                    writing = false;
                    queue = batch.concat(queue); // вернуть строки в очередь, чтобы не потерять
                    trimQueue();
                    return handleStreamError(target, error);
                }

                verifyFile((verifyError, stillSame) => {
                    writing = false;

                    if (verifyError) {
                        queue = batch.concat(queue);
                        trimQueue();
                        return handleStreamError(target, verifyError);
                    }

                    if (!stillSame) {
                        queue = batch.concat(queue);
                        trimQueue();
                        return reopen();
                    }

                    fileSize += Buffer.byteLength(data);

                    if (fileSize >= maxFileSize && Date.now() >= noRotateUntil) {
                        return rotate();
                    }

                    flush();
                });
            });
        });
    }

    async function renameIfExists(from, to) {
        try {
            await fs.promises.rename(from, to);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async function rotate() {
        rotating = true;
        ready = false;

        const old = stream;

        stream = null;

        if (old) {
            await new Promise((resolve) => {
                old.once('close', resolve);
                old.end();
            });
        }

        try {
            if (maxBackups < 1) {
                await fs.promises.unlink(filePath).catch((error) => {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                });
            } else {
                for (let i = maxBackups - 1; i >= 1; i--) {
                    await renameIfExists(`${filePath}.${i}`, `${filePath}.${i + 1}`);
                }

                await renameIfExists(filePath, `${filePath}.1`);
            }
        } catch (error) {
            onError('не удалось выполнить ротацию лога', error);
            noRotateUntil = Date.now() + 60000; // не долбить ротацией каждую запись
        }

        rotating = false;
        open();
    }

    /** Добавить строку в лог. Никогда не бросает исключений. */
    function write(line) {
        if (closing) {
            return;
        }

        queue.push(line.endsWith('\n') ? line : `${line}\n`);
        trimQueue();

        if (!stream && !retryTimer) {
            open();
        }

        flush();
    }

    /** Дописать очередь и закрыть файл (вызывать при остановке сервера). */
    async function close(timeoutMs = 3000) {
        closing = true;

        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }

        const deadline = Date.now() + timeoutMs;

        while ((queue.length > 0 || writing || rotating || opening) && Date.now() < deadline) {
            if (!stream && !opening && !rotating) {
                break; // файл недоступен, ждать нечего
            }

            flush();
            await new Promise((resolve) => setTimeout(resolve, 20));
        }

        if (queue.length > 0) {
            onError(`при закрытии не записано строк: ${queue.length}`);
        }

        const last = stream;

        stream = null;
        ready = false;

        if (last) {
            await new Promise((resolve) => {
                last.once('close', resolve);
                last.end();
            });
        }
    }

    open();

    return { write, close };
}

module.exports = createFileLogger;

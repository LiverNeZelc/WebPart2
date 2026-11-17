'use strict';

const methodActions = {
    GET: 'view',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete'
};

const recordUserAction = (UserActionLog, action) => {
    if (!UserActionLog) return Promise.resolve();
    const record = {
        user_id: action.user_id ?? null,
        username: action.username ?? null,
        action: action.action,
        resource_type: action.resource_type ?? null,
        resource_id: action.resource_id ?? null,
        success: action.success ?? action.outcome === 'success',
        status_code: action.status_code ?? 200,
        details: action.details ?? action.metadata ?? {}
    };
    return Promise.resolve().then(() => UserActionLog.create(record)).catch((error) => {
        console.error('Failed to write user action log:', error);
    });
};

const createUserActionLogger = (UserActionLog, resourceType) => (req, res, next) => {
    res.once('finish', () => {
        const methodAction = methodActions[req.method] || req.method.toLowerCase();
        const path = req.path.replace(/\/+$/, '') || '/';
        const actionName = resourceType === 'auth'
            ? path.slice(1) || 'request'
            : `${path === '/' && req.method === 'GET' ? 'list' : methodAction}`;
        const action = resourceType === 'auth'
            ? `auth.${actionName}`
            : `${resourceType}.${actionName}`;
        const userId = res.locals.actionUserId ?? req.user?.userId ?? null;
        const username = res.locals.actionUsername ?? req.user?.username ?? null;
        const pathId = path.split('/').filter(Boolean).at(-1);

        void recordUserAction(UserActionLog, {
            user_id: userId,
            username,
            action: action.slice(0, 80),
            resource_type: resourceType,
            resource_id: typeof req.params?.id === 'string'
                ? req.params.id.slice(0, 100)
                : (resourceType !== 'auth' && pathId ? pathId.slice(0, 100) : null),
            outcome: res.statusCode < 400 ? 'success' : 'failure',
            status_code: res.statusCode,
            details: {}
        });
    });
    next();
};

module.exports = { createUserActionLogger, recordUserAction };

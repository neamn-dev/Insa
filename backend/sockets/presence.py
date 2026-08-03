from flask import request
from flask_socketio import emit
from extensions import socketio
from sockets.document_sync import socket_users, room_members

@socketio.on('cursor:update')
def handle_cursor_update(data):
    data = data or {}
    sid = request.sid
    user_info = socket_users.get(sid)
    if not user_info:
        return

    document_id = data.get('document_id') or user_info.get('document_id')
    if not document_id:
        return

    room = f"document:{document_id}"
    emit('cursor:update', {
        'user_id': user_info['user_id'],
        'name': user_info['name'],
        'cursor': data.get('cursor'), # position, index, selection range
    }, to=room, include_self=False)

@socketio.on('typing:start')
def handle_typing_start(data):
    data = data or {}
    sid = request.sid
    user_info = socket_users.get(sid)
    if not user_info:
        return

    document_id = data.get('document_id') or user_info.get('document_id')
    if not document_id:
        return

    room = f"document:{document_id}"
    emit('typing:status', {
        'user_id': user_info['user_id'],
        'name': user_info['name'],
        'is_typing': True
    }, to=room, include_self=False)

@socketio.on('typing:stop')
def handle_typing_stop(data):
    data = data or {}
    sid = request.sid
    user_info = socket_users.get(sid)
    if not user_info:
        return

    document_id = data.get('document_id') or user_info.get('document_id')
    if not document_id:
        return

    room = f"document:{document_id}"
    emit('typing:status', {
        'user_id': user_info['user_id'],
        'name': user_info['name'],
        'is_typing': False
    }, to=room, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    user_info = socket_users.pop(sid, None)

    if user_info and user_info.get('document_id'):
        document_id = user_info['document_id']
        if document_id in room_members and sid in room_members[document_id]:
            room_members[document_id].remove(sid)

        room = f"document:{document_id}"
        active_users = []
        for s in room_members.get(document_id, []):
            if s in socket_users:
                u = socket_users[s]
                active_users.append({
                    'user_id': u['user_id'],
                    'name': u['name'],
                    'email': u['email'],
                    'role': u.get('role', 'VIEWER')
                })

        emit('presence:update', {
            'document_id': document_id,
            'active_users': active_users
        }, to=room)

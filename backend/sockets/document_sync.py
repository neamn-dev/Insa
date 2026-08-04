from flask import request
from flask_socketio import join_room, leave_room, emit
from extensions import socketio
from middleware.auth_middleware import verify_socket_token
from services.permission_service import can_view, can_edit, get_user_document_role
from services.collaboration_service import get_document_state, save_document_state

# Track socket connections: sid -> user_info
socket_users = {}
# Track document rooms: document_id -> set of sid
room_members = {}

@socketio.on('document:join')
def handle_document_join(data):
    data = data or {}
    token = data.get('token')
    document_id = data.get('document_id')

    user_info, error = verify_socket_token(token)
    if error:
        emit('error', {'message': f'Socket auth failed: {error}'})
        return

    if not document_id:
        emit('error', {'message': 'document_id is required.'})
        return

    user_id = user_info['user_id']
    if not can_view(user_id, document_id):
        emit('error', {'message': 'Permission denied. You cannot view this document.'})
        return

    room = f"document:{document_id}"
    join_room(room)
    join_room(f"user:{user_id}")

    role = get_user_document_role(user_id, document_id)
    user_info['role'] = role
    user_info['document_id'] = document_id
    socket_users[request.sid] = user_info

    if document_id not in room_members:
        room_members[document_id] = set()
    room_members[document_id].add(request.sid)

    # Send current state to joined client
    current_state = get_document_state(document_id)
    emit('document:sync', {
        'document_id': document_id,
        'state_data': current_state,
        'user_role': role
    })

    # Broadcast presence
    active_users = []
    for sid in room_members.get(document_id, []):
        if sid in socket_users:
            u = socket_users[sid]
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

def notify_share_updated(document_id, target_user_id, role, target_email=None):
    """
    Helper function to broadcast share updates in real-time to active collaborators.
    """
    str_target_id = str(target_user_id) if target_user_id else None
    
    # Update socket_users cache if user is currently connected
    for sid, uinfo in list(socket_users.items()):
        if str(uinfo.get('user_id')) == str_target_id and uinfo.get('document_id') == document_id:
            uinfo['role'] = role

    room = f"document:{document_id}"
    user_room = f"user:{str_target_id}"

    payload = {
        'document_id': document_id,
        'user_id': str_target_id,
        'user_email': target_email,
        'role': role
    }

    socketio.emit('document:share_updated', payload, to=room)
    if str_target_id:
        socketio.emit('document:share_updated', payload, to=user_room)

    # Broadcast updated presence
    active_users = []
    for sid in room_members.get(document_id, []):
        if sid in socket_users:
            u = socket_users[sid]
            active_users.append({
                'user_id': u['user_id'],
                'name': u['name'],
                'email': u['email'],
                'role': u.get('role', 'VIEWER')
            })

    socketio.emit('presence:update', {
        'document_id': document_id,
        'active_users': active_users
    }, to=room)


@socketio.on('document:update')
def handle_document_update(data):
    data = data or {}
    sid = request.sid
    user_info = socket_users.get(sid)

    document_id = data.get('document_id')
    token = data.get('token')

    # Fallback authentication if sid missing from socket_users (e.g. after socket reconnect)
    if not user_info and token:
        info, error = verify_socket_token(token)
        if not error:
            user_id = info['user_id']
            role = get_user_document_role(user_id, document_id)
            info['role'] = role
            info['document_id'] = document_id
            socket_users[sid] = info
            user_info = info
            if document_id:
                if document_id not in room_members:
                    room_members[document_id] = set()
                room_members[document_id].add(sid)

    if not user_info:
        emit('error', {'message': 'Unauthenticated socket session.'})
        return

    document_id = document_id or user_info.get('document_id')
    update_data = data.get('update_data') or data.get('state_data')

    if not document_id or update_data is None:
        return

    user_id = user_info['user_id']

    # Security Enforcer: Reject document edits from Viewers or Commenters!
    if not can_edit(user_id, document_id):
        emit('error', {'message': 'Permission denied. Viewer/Commenter cannot modify document.'})
        return

    room = f"document:{document_id}"
    join_room(room)

    # Broadcast update to all other collaborators in room in real-time
    emit('document:update', {
        'document_id': document_id,
        'update_data': update_data,
        'user_id': str(user_id),
        'user_name': user_info['name']
    }, to=room, include_self=False)

    # Persist state
    if data.get('full_state'):
        save_document_state(document_id, data.get('full_state'))
    elif update_data:
        save_document_state(document_id, update_data)

@socketio.on('document:leave')
def handle_document_leave(data):
    data = data or {}
    sid = request.sid
    user_info = socket_users.get(sid)
    document_id = data.get('document_id') or (user_info.get('document_id') if user_info else None)

    if document_id:
        room = f"document:{document_id}"
        leave_room(room)
        if document_id in room_members and sid in room_members[document_id]:
            room_members[document_id].remove(sid)

        # Broadcast presence update
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

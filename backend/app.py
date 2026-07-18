import os
import json
from datetime import timedelta, datetime, timezone
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY', 'jwt_dev_secret')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

db = SQLAlchemy(app)
jwt = JWTManager(app)
CORS(app)

# ─── Models ───────────────────────────────────────────────────────────

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'email': self.email}


class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), default='Untitled')
    content = db.Column(db.Text, default='')
    material_id = db.Column(db.String(100), nullable=True)
    canvas_data = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'content': self.content,
            'material_id': self.material_id, 'canvas_data': self.canvas_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    subject = db.Column(db.String(100), default='')
    status = db.Column(db.String(20), default='In Progress')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'description': self.description,
            'subject': self.subject, 'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_messages')

    def to_dict(self):
        return {
            'id': self.id, 'sender_id': self.sender_id, 'receiver_id': self.receiver_id,
            'content': self.content,
            'sender_name': self.sender.username if self.sender else None,
            'receiver_name': self.receiver.username if self.receiver else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class GroupChat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        members = [m.user.to_dict() for m in GroupMember.query.filter_by(group_id=self.id).all()]
        return {'id': self.id, 'name': self.name, 'created_by': self.created_by, 'members': members,
                'created_at': self.created_at.isoformat() if self.created_at else None}


class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    user = db.relationship('User')


class GroupMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sender = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id, 'group_id': self.group_id, 'sender_id': self.sender_id,
            'content': self.content, 'sender_name': self.sender.username if self.sender else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class GroupEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group_chat.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    event_type = db.Column(db.String(20), default='meeting')  # meeting or deadline
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'group_id': self.group_id, 'title': self.title,
                'date': self.date, 'event_type': self.event_type}


class ProgressLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    activity_type = db.Column(db.String(50), nullable=False)  # library_view, learning_time, note_created, project_work
    description = db.Column(db.String(200), default='')
    duration_minutes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


    def to_dict(self):
        return {
            'id': self.id, 'activity_type': self.activity_type,
            'description': self.description, 'duration_minutes': self.duration_minutes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Homework(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    due_date = db.Column(db.String(20), nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'subject': self.subject, 'title': self.title,
            'description': self.description, 'due_date': self.due_date,
            'is_completed': self.is_completed,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Classwork(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    date = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'subject': self.subject, 'title': self.title,
            'description': self.description, 'date': self.date,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class DiaryNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    author = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # Teacher or Parent
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'author': self.author, 'role': self.role,
            'content': self.content, 'date': self.date,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }



with app.app_context():
    db.create_all()


# ─── Auth Routes ──────────────────────────────────────────────────────

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'message': 'Registered successfully', 'token': token, 'user': user.to_dict()}), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        token = create_access_token(identity=str(user.id))
        return jsonify({'token': token, 'user': user.to_dict()}), 200
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


# ─── Notes Routes ─────────────────────────────────────────────────────

@app.route('/api/notes', methods=['GET'])
@jwt_required()
def get_notes():
    uid = int(get_jwt_identity())
    notes = Note.query.filter_by(user_id=uid).order_by(Note.updated_at.desc()).all()
    return jsonify([n.to_dict() for n in notes]), 200


@app.route('/api/notes', methods=['POST'])
@jwt_required()
def create_note():
    uid = int(get_jwt_identity())
    data = request.get_json()
    note = Note(user_id=uid, title=data.get('title', 'Untitled'),
                content=data.get('content', ''), material_id=data.get('material_id'))
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@jwt_required()
def update_note(note_id):
    uid = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=uid).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    data = request.get_json()
    if 'title' in data: note.title = data['title']
    if 'content' in data: note.content = data['content']
    if 'canvas_data' in data: note.canvas_data = data['canvas_data']
    if 'material_id' in data: note.material_id = data['material_id']
    db.session.commit()
    return jsonify(note.to_dict()), 200


@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    uid = int(get_jwt_identity())
    note = Note.query.filter_by(id=note_id, user_id=uid).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# ─── Projects Routes ─────────────────────────────────────────────────

@app.route('/api/projects', methods=['GET'])
@jwt_required()
def get_projects():
    uid = int(get_jwt_identity())
    projects = Project.query.filter_by(user_id=uid).order_by(Project.updated_at.desc()).all()
    return jsonify([p.to_dict() for p in projects]), 200


@app.route('/api/projects', methods=['POST'])
@jwt_required()
def create_project():
    uid = int(get_jwt_identity())
    data = request.get_json()
    project = Project(user_id=uid, title=data.get('title', 'Untitled'),
                      description=data.get('description', ''), subject=data.get('subject', ''))
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_dict()), 201


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    uid = int(get_jwt_identity())
    project = Project.query.filter_by(id=project_id, user_id=uid).first()
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    data = request.get_json()
    for field in ['title', 'description', 'subject', 'status']:
        if field in data:
            setattr(project, field, data[field])
    db.session.commit()
    return jsonify(project.to_dict()), 200


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    uid = int(get_jwt_identity())
    project = Project.query.filter_by(id=project_id, user_id=uid).first()
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@app.route('/api/projects/<int:project_id>/brainstorm', methods=['POST'])
@jwt_required()
def brainstorm_project(project_id):
    uid = int(get_jwt_identity())
    project = Project.query.filter_by(id=project_id, user_id=uid).first()
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    prompt = data.get('prompt', '')
    context = f"Project: {project.title}\nDescription: {project.description}\nSubject: {project.subject}\n\nUser prompt: {prompt}"

    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            f"You are a creative brainstorming assistant for student projects. Help the student brainstorm ideas, approaches, and structures for their project. Be encouraging and creative.\n\n{context}"
        )
        return jsonify({'response': response.text}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Messages Routes ─────────────────────────────────────────────────

@app.route('/api/users/search', methods=['GET'])
@jwt_required()
def search_users():
    email = request.args.get('email', '').strip()
    if not email:
        return jsonify([]), 200
    users = User.query.filter(User.email.ilike(f'%{email}%')).limit(10).all()
    uid = int(get_jwt_identity())
    return jsonify([u.to_dict() for u in users if u.id != uid]), 200


@app.route('/api/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    uid = int(get_jwt_identity())
    # Get unique users this user has exchanged messages with
    sent = db.session.query(Message.receiver_id).filter(Message.sender_id == uid).distinct()
    received = db.session.query(Message.sender_id).filter(Message.receiver_id == uid).distinct()
    partner_ids = set([r[0] for r in sent] + [r[0] for r in received])

    convos = []
    for pid in partner_ids:
        partner = User.query.get(pid)
        if not partner:
            continue
        last_msg = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == uid, Message.receiver_id == pid),
                db.and_(Message.sender_id == pid, Message.receiver_id == uid)
            )
        ).order_by(Message.created_at.desc()).first()
        convos.append({
            'user': partner.to_dict(),
            'last_message': last_msg.to_dict() if last_msg else None
        })
    convos.sort(key=lambda c: c['last_message']['created_at'] if c['last_message'] else '', reverse=True)
    return jsonify(convos), 200


@app.route('/api/messages/<int:partner_id>', methods=['GET'])
@jwt_required()
def get_messages(partner_id):
    uid = int(get_jwt_identity())
    messages = Message.query.filter(
        db.or_(
            db.and_(Message.sender_id == uid, Message.receiver_id == partner_id),
            db.and_(Message.sender_id == partner_id, Message.receiver_id == uid)
        )
    ).order_by(Message.created_at.asc()).all()
    return jsonify([m.to_dict() for m in messages]), 200


@app.route('/api/messages/<int:partner_id>', methods=['POST'])
@jwt_required()
def send_message(partner_id):
    uid = int(get_jwt_identity())
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Empty message'}), 400
    msg = Message(sender_id=uid, receiver_id=partner_id, content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ─── Group Chat Routes ───────────────────────────────────────────────

@app.route('/api/groups', methods=['GET'])
@jwt_required()
def get_groups():
    uid = int(get_jwt_identity())
    member_groups = GroupMember.query.filter_by(user_id=uid).all()
    group_ids = [m.group_id for m in member_groups]
    groups = GroupChat.query.filter(GroupChat.id.in_(group_ids)).all() if group_ids else []
    return jsonify([g.to_dict() for g in groups]), 200


@app.route('/api/groups', methods=['POST'])
@jwt_required()
def create_group():
    uid = int(get_jwt_identity())
    data = request.get_json()
    group = GroupChat(name=data.get('name', 'New Group'), created_by=uid)
    db.session.add(group)
    db.session.flush()
    # Add creator as member
    db.session.add(GroupMember(group_id=group.id, user_id=uid))
    # Add other members
    for mid in data.get('member_ids', []):
        if mid != uid:
            db.session.add(GroupMember(group_id=group.id, user_id=mid))
    db.session.commit()
    return jsonify(group.to_dict()), 201


@app.route('/api/groups/<int:group_id>/messages', methods=['GET'])
@jwt_required()
def get_group_messages(group_id):
    messages = GroupMessage.query.filter_by(group_id=group_id).order_by(GroupMessage.created_at.asc()).all()
    return jsonify([m.to_dict() for m in messages]), 200


@app.route('/api/groups/<int:group_id>/messages', methods=['POST'])
@jwt_required()
def send_group_message(group_id):
    uid = int(get_jwt_identity())
    data = request.get_json()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Empty message'}), 400
    msg = GroupMessage(group_id=group_id, sender_id=uid, content=content)
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


@app.route('/api/groups/<int:group_id>/events', methods=['GET'])
@jwt_required()
def get_group_events(group_id):
    events = GroupEvent.query.filter_by(group_id=group_id).order_by(GroupEvent.date.asc()).all()
    return jsonify([e.to_dict() for e in events]), 200


@app.route('/api/groups/<int:group_id>/events', methods=['POST'])
@jwt_required()
def create_group_event(group_id):
    uid = int(get_jwt_identity())
    data = request.get_json()
    event = GroupEvent(group_id=group_id, title=data.get('title', ''),
                       date=data.get('date', ''), event_type=data.get('event_type', 'meeting'),
                       created_by=uid)
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


# ─── AI Tutor Routes ─────────────────────────────────────────────────

@app.route('/api/ai/chat', methods=['POST'])
@jwt_required()
def ai_chat():
    data = request.get_json()
    user_message = data.get('message', '')
    history = data.get('history', [])

    system_prompt = """You are a Socratic tutor for students. Your rules:
1. NEVER give direct answers to academic questions.
2. Instead, ask guiding questions that lead the student to discover the answer themselves.
3. Explain underlying concepts and principles.
4. Break complex problems into smaller steps and ask the student to solve each step.
5. When the student makes progress, acknowledge it and guide them further.
6. Be encouraging, patient, and supportive.
7. If the student is frustrated, offer a hint but still make them think.
8. Use examples and analogies to make concepts clearer.
9. Keep responses concise and focused."""

    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-3-pro-preview',
                                       system_instruction=system_prompt)

        chat_history = []
        for msg in history:
            role = 'user' if msg.get('role') == 'user' else 'model'
            chat_history.append({'role': role, 'parts': [msg.get('content', '')]})

        chat = model.start_chat(history=chat_history)
        response = chat.send_message(user_message)
        return jsonify({'response': response.text}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Progress Routes ─────────────────────────────────────────────────

@app.route('/api/progress', methods=['GET'])
@jwt_required()
def get_progress():
    uid = int(get_jwt_identity())
    logs = ProgressLog.query.filter_by(user_id=uid).order_by(ProgressLog.created_at.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs]), 200


@app.route('/api/progress', methods=['POST'])
@jwt_required()
def log_progress():
    uid = int(get_jwt_identity())
    data = request.get_json()
    log = ProgressLog(user_id=uid, activity_type=data.get('activity_type', ''),
                      description=data.get('description', ''),
                      duration_minutes=data.get('duration_minutes', 0))
    db.session.add(log)
    db.session.commit()
    return jsonify(log.to_dict()), 201



# ─── Library Route (static data) ─────────────────────────────────────

@app.route('/api/library', methods=['GET'])
@jwt_required()
def get_library():
    library_path = os.path.join(os.path.dirname(__file__), 'library_data.json')
    try:
        with open(library_path, 'r') as f:
            data = json.load(f)
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify([]), 200


# ─── Class Diary Routes ──────────────────────────────────────────────

@app.route('/api/diary/seed', methods=['POST'])
@jwt_required()
def seed_diary():
    uid = int(get_jwt_identity())
    # Clear existing
    Homework.query.filter_by(user_id=uid).delete()
    Classwork.query.filter_by(user_id=uid).delete()
    DiaryNote.query.filter_by(user_id=uid).delete()
    
    today = datetime.now().strftime('%Y-%m-%d')
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Homework
    db.session.add(Homework(user_id=uid, subject='Math', title='Calculus Worksheet', description='Complete problems 1-10', due_date=today))
    db.session.add(Homework(user_id=uid, subject='History', title='Read Chapter 5', description='Prepare for discussion', due_date=today, is_completed=True))
    db.session.add(Homework(user_id=uid, subject='Physics', title='Lab Setup', description='Read lab manual', due_date=tomorrow))
    
    # Classwork
    db.session.add(Classwork(user_id=uid, subject='Physics', title='Lab Report', description='Projectile Motion experiment', date=today))
    db.session.add(Classwork(user_id=uid, subject='English', title='Essay Draft', description='First draft of Hamlet essay', date=today))
    
    # Diary Notes
    db.session.add(DiaryNote(user_id=uid, author='Mrs. Johnson', role='Teacher', content='Alex was very helpful in class today.', date=today))
    db.session.add(DiaryNote(user_id=uid, author='Mr. Smith', role='Teacher', content='Reminder: Science fair project due next week.', date=tomorrow))
    
    db.session.commit()
    return jsonify({'message': 'Seeded'}), 201


@app.route('/api/diary', methods=['GET'])
@jwt_required()
def get_diary_by_date():
    uid = int(get_jwt_identity())
    date = request.args.get('date', '').strip()
    
    if not date:
        # Default to today if no date provided? Or return empty?
        # Let's return today's data if no date is provided, or just require it.
        # The frontend will likely send it.
        return jsonify({'error': 'Date required'}), 400
        
    homework = Homework.query.filter_by(user_id=uid, due_date=date).all()
    classwork = Classwork.query.filter_by(user_id=uid, date=date).all()
    notes = DiaryNote.query.filter_by(user_id=uid, date=date).all()
    
    return jsonify({
        'homework': [h.to_dict() for h in homework],
        'classwork': [c.to_dict() for c in classwork],
        'notes': [n.to_dict() for n in notes]
    }), 200


@app.route('/api/diary/all', methods=['GET'])
@jwt_required()
def get_all_diary_dates():
    uid = int(get_jwt_identity())
    
    # Get all unique dates that have any events
    hw_dates = db.session.query(Homework.due_date).filter_by(user_id=uid).distinct()
    cw_dates = db.session.query(Classwork.date).filter_by(user_id=uid).distinct()
    note_dates = db.session.query(DiaryNote.date).filter_by(user_id=uid).distinct()
    
    all_dates = set([d[0] for d in hw_dates] + [d[0] for d in cw_dates] + [d[0] for d in note_dates])
    return jsonify(list(all_dates)), 200


@app.route('/api/diary/homework/<int:hw_id>', methods=['PATCH'])
@jwt_required()
def toggle_homework(hw_id):
    uid = int(get_jwt_identity())
    hw = Homework.query.filter_by(id=hw_id, user_id=uid).first()
    if not hw:
        return jsonify({'error': 'Not found'}), 404
        
    hw.is_completed = not hw.is_completed
    db.session.commit()
    return jsonify(hw.to_dict()), 200



# ─── Run ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin@123';

let dbReady = false;
let dbInfo = { host: null, name: null };

const getBearerToken = (req) => {
  const raw = String(req.headers?.authorization || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
};

const requireAdmin = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

let s3Client = null;
const getS3 = () => {
  if (s3Client) return s3Client;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;

  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  return s3Client;
};

const isAllowedImageType = (contentType) => {
  if (!contentType) return false;
  return contentType === 'image/png' || contentType === 'image/jpeg' || contentType === 'image/webp';
};

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'user'], default: 'user' },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: false,
    strict: true,
  }
);

const User = mongoose.model('User', UserSchema);

const ensureAdminUser = async () => {
  if (!dbReady) return;
  const email = ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.updateOne(
    { email },
    { $set: { email, passwordHash, role: 'admin' }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
};

const connectDb = async () => {
  if (!MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.error('Missing MONGODB_URI. Create backend/.env based on backend/.env.example');
    dbReady = false;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    dbReady = true;
    dbInfo = {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
    // eslint-disable-next-line no-console
    console.log(`MongoDB connected: ${dbInfo.host}/${dbInfo.name}`);
  } catch (e) {
    dbReady = false;
    dbInfo = { host: null, name: null };
    // eslint-disable-next-line no-console
    console.error('MongoDB connection failed:', e);
  }
};

const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
  },
  {
    timestamps: false,
    strict: false,
  }
);

const Project = mongoose.model('Project', ProjectSchema);

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  const storageReady = Boolean(getS3());
  res.json({ ok: true, dbReady, db: dbInfo, storageReady });
});

app.post('/api/storage/presign-upload', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  return requireAdmin(req, res, async () => {
  const s3 = getS3();
  if (!s3 || !S3_BUCKET) {
    return res.status(503).json({ message: 'Storage not configured' });
  }

  const contentType = String(req.body?.contentType || '').trim().toLowerCase();
  const prefix = String(req.body?.prefix || 'uploads').trim().replace(/[^a-z0-9/_-]/gi, '');
  const ext = String(req.body?.ext || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!isAllowedImageType(contentType)) {
    return res.status(400).json({ message: 'Unsupported content type' });
  }

  const safeExt = ext || (contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg');
  const key = `${prefix}/${Date.now()}-${randomUUID()}.${safeExt}`;

  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  res.json({ key, url });
  });
});

app.get('/api/storage/signed-url', async (req, res) => {
  const s3 = getS3();
  if (!s3 || !S3_BUCKET) {
    return res.status(503).json({ message: 'Storage not configured' });
  }

  const rawKey = String(req.query?.key || '').trim();
  const key = rawKey.startsWith('s3:') ? rawKey.slice(3) : rawKey;
  if (!key) {
    return res.status(400).json({ message: 'Missing key' });
  }

  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
  res.json({ url });
});

app.post('/api/auth/register', (_req, res) => {
  res.status(404).json({ message: 'Registration is disabled. Please login.' });
});

app.post('/api/auth/login', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ id: 'admin', email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ id: 'admin', email, role: 'admin', token });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: user._id.toString(), email: user.email, role: user.role, token });
});

app.get('/api/projects', async (_req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  const projects = await Project.find({}).lean();
  const light = projects.map((p) => {
    const next = { ...p };
    if (typeof next.layoutImage === 'string') {
      const s = next.layoutImage;
      if (s.startsWith('data:image/') || s.startsWith('idb:') || s.length > 50_000) {
        next.layoutImage = '';
      }
    }
    if (next.mapConfig && typeof next.mapConfig === 'object') {
      next.mapConfig = { ...next.mapConfig };
      if (typeof next.mapConfig.imageUrl === 'string') {
        const s = next.mapConfig.imageUrl;
        if (s.startsWith('data:image/') || s.startsWith('idb:') || s.length > 50_000) {
          next.mapConfig.imageUrl = '';
        }
      }
    }
    return next;
  });
  res.json(light);
});

app.get('/api/projects/:id', async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  const { id } = req.params;
  const project = await Project.findOne({ id }).lean();
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }
  res.json(project);
});

app.post('/api/projects', requireAdmin, async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  const body = req.body || {};
  const id = body.id || Date.now().toString();
  const createdAt = body.createdAt || new Date().toISOString();
  const doc = await Project.create({ ...body, id, createdAt });
  res.status(201).json(doc);
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  const { id } = req.params;
  const updates = req.body || {};

  const updated = await Project.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
  if (!updated) {
    return res.status(404).json({ message: 'Project not found' });
  }
  res.json(updated);
});

app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  const { id } = req.params;
  const deleted = await Project.findOneAndDelete({ id }).lean();
  if (!deleted) {
    return res.status(404).json({ message: 'Project not found' });
  }
  res.json({ ok: true });
});

connectDb().finally(() => {
  ensureAdminUser().catch(() => {});
  app.listen(PORT, () => {
  // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${PORT}`);
  });
});

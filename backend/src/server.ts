import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import presentationRoutes from './routes/presentations';
import slideRoutes from './routes/slides';
import publicRoutes from './routes/public';
import mediaRoutes, { MEDIA_DIRECTORY } from './routes/media';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 'http://localhost:3000',
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/presentations', presentationRoutes);
app.use('/api/slides', slideRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/media', express.static(MEDIA_DIRECTORY, { immutable: true, maxAge: '1y', index: false, dotfiles: 'deny', fallthrough: false, setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Zeivio Backend', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`🚀 Zeivio Backend running on http://localhost:${PORT}`);
});

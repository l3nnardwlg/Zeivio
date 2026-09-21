import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getPresentations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const presentations = await prisma.presentation.findMany({
      where: { ownerId: req.user.userId },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ presentations });
  } catch (error) {
    console.error('Get presentations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createPresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, description, slideCount } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    let accessCode = generateAccessCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await prisma.presentation.findUnique({ where: { accessCode } });
      if (!existing) {
        isUnique = true;
      } else {
        accessCode = generateAccessCode();
        attempts++;
      }
    }

    const presentation = await prisma.presentation.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        slideCount: slideCount ? parseInt(slideCount, 10) : 1,
        accessCode,
        ownerId: req.user.userId,
      },
    });

    res.status(201).json({ presentation });
  } catch (error) {
    console.error('Create presentation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getPresentationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    res.json({ presentation });
  } catch (error) {
    console.error('Get presentation details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deletePresentation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;

    const presentation = await prisma.presentation.findUnique({ where: { id } });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    if (presentation.ownerId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden: You do not own this presentation' });
      return;
    }

    await prisma.presentation.delete({ where: { id } });

    res.json({ message: 'Presentation deleted successfully' });
  } catch (error) {
    console.error('Delete presentation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

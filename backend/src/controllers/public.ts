import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function getPublicPresentationByCode(req: Request, res: Response): Promise<void> {
  try {
    const code = (req.params.code as string).toUpperCase().trim();

    const presentation = await prisma.presentation.findUnique({
      where: { accessCode: code },
      include: {
        owner: {
          select: { name: true },
        },
        slides: {
          orderBy: { orderIndex: 'asc' },
          include: {
            votes: true,
          },
        },
      },
    });

    if (!presentation) {
      res.status(404).json({ error: 'Präsentation mit diesem Code wurde nicht gefunden.' });
      return;
    }

    res.json({ presentation });
  } catch (error) {
    console.error('Get public presentation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function submitVote(req: Request, res: Response): Promise<void> {
  try {
    const { slideId, optionIndex } = req.body;

    if (!slideId || optionIndex === undefined) {
      res.status(400).json({ error: 'slideId and optionIndex are required' });
      return;
    }

    const slide = await prisma.slide.findUnique({ where: { id: slideId } });

    if (!slide) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    const vote = await prisma.pollVote.create({
      data: {
        slideId,
        optionIndex: parseInt(optionIndex, 10),
      },
    });

    const votes = await prisma.pollVote.findMany({
      where: { slideId },
    });

    res.status(201).json({ message: 'Vote recorded', vote, totalVotes: votes });
  } catch (error) {
    console.error('Submit vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateScene } from '../lib/scene-validation';

export async function getSlides(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const presentationId = req.params.presentationId as string;

    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
    });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    if (presentation.ownerId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    let slides = await prisma.slide.findMany({
      where: { presentationId },
      orderBy: { orderIndex: 'asc' },
      include: {
        votes: true,
      },
    });

    // Auto-create initial slide if presentation is empty
    if (slides.length === 0) {
      const defaultSlide = await prisma.slide.create({
        data: {
          presentationId,
          orderIndex: 0,
          type: 'CONTENT',
          title: presentation.title,
          subtitle: presentation.description || 'Willkommen zu Zeivio',
          content: 'Füge Aufzählungspunkte oder Inhalt hinzu.',
        },
        include: {
          votes: true,
        },
      });
      slides = [defaultSlide];
    }

    res.json({ slides });
  } catch (error) {
    console.error('Get slides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createSlide(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const presentationId = req.params.presentationId as string;
    const { type = 'CONTENT', title = 'Neue Folie', subtitle, content, options, design } = req.body;

    if (design !== undefined) {
      const validation = validateScene(design);
      if(validation){res.status(400).json({error:validation});return;}
    }
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: { slides: true },
    });

    if (!presentation) {
      res.status(404).json({ error: 'Presentation not found' });
      return;
    }

    if (presentation.ownerId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const nextOrderIndex = presentation.slides.length;

    const defaultOptions = type === 'POLL' ? JSON.stringify(['Option A', 'Option B', 'Option C']) : options;

    const slide = await prisma.slide.create({
      data: {
        presentationId,
        orderIndex: nextOrderIndex,
        type,
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        content: content ? content.trim() : null,
        options: defaultOptions,
        design: typeof design === 'string' ? design : null,
      },
      include: {
        votes: true,
      },
    });

    await prisma.presentation.update({
      where: { id: presentationId },
      data: { slideCount: presentation.slides.length + 1 },
    });

    res.status(201).json({ slide });
  } catch (error) {
    console.error('Create slide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSlide(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const slideId = req.params.id as string;
    const { title, subtitle, content, type, options, orderIndex, design } = req.body;

    if (design !== undefined) {
      const validation = validateScene(design);
      if(validation){res.status(400).json({error:validation});return;}
    }
    const slide = await prisma.slide.findUnique({
      where: { id: slideId },
      include: { presentation: true },
    });

    if (!slide) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    if (slide.presentation.ownerId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updatedSlide = await prisma.slide.update({
      where: { id: slideId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(subtitle !== undefined && { subtitle: subtitle ? subtitle.trim() : null }),
        ...(content !== undefined && { content: content ? content.trim() : null }),
        ...(type !== undefined && { type }),
        ...(options !== undefined && { options: typeof options === 'string' ? options : JSON.stringify(options) }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(design !== undefined && { design: typeof design === 'string' ? design : JSON.stringify(design) }),
      },
      include: {
        votes: true,
      },
    });

    res.json({ slide: updatedSlide });
  } catch (error) {
    console.error('Update slide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSlide(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const slideId = req.params.id as string;

    const slide = await prisma.slide.findUnique({
      where: { id: slideId },
      include: { presentation: { include: { slides: true } } },
    });

    if (!slide) {
      res.status(404).json({ error: 'Slide not found' });
      return;
    }

    if (slide.presentation.ownerId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await prisma.slide.delete({ where: { id: slideId } });

    const remainingSlidesCount = Math.max(1, slide.presentation.slides.length - 1);
    await prisma.presentation.update({
      where: { id: slide.presentationId },
      data: { slideCount: remainingSlidesCount },
    });

    res.json({ message: 'Slide deleted successfully' });
  } catch (error) {
    console.error('Delete slide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function reorderSlides(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const presentationId = req.params.presentationId as string;
    const ids = req.body?.slideIds;
    if (!req.user) {res.status(401).json({error:'Unauthorized'});return;}
    if(!Array.isArray(ids) || ids.length<1 || ids.length>500 || !ids.every((v:unknown)=>typeof v==='string') || new Set(ids).size!==ids.length) {
      res.status(400).json({error:'Invalid slide ordering'});return;
    }
    const presentation=await prisma.presentation.findUnique({where:{id:presentationId},include:{slides:{select:{id:true}}}});
    if(!presentation){res.status(404).json({error:'Presentation not found'});return;}
    if(presentation.ownerId!==req.user.userId){res.status(403).json({error:'Forbidden'});return;}
    if(ids.length!==presentation.slides.length || !presentation.slides.every(s=>ids.includes(s.id))) {
      res.status(400).json({error:'Ordering must include all slides'});return;
    }
    await prisma.$transaction(ids.map((slideId:string,index:number)=>prisma.slide.update({where:{id:slideId},data:{orderIndex:index}})));
    res.json({message:'Slides reordered'});
  }catch(error){console.error('Reorder slides error:',error);res.status(500).json({error:'Internal server error'});}
}

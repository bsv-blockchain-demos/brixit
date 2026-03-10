import { Request, Response } from 'express'
import prisma from '../db/client.js'

export async function readyProbe(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'ready' })
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: (err as Error).message })
  }
}

import express from "express";
import multer from "multer";
import { env } from "../config/env.js";

export const memoryUpload = (maxMb: number) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.round(maxMb * 1024 * 1024), files: 1 } });

/** CV and cover letter uploads. */
export const resumeUpload = memoryUpload(env.MAX_UPLOAD_MB);
/** Onboarding documents and offer letters. */
export const documentUpload = memoryUpload(env.MAX_ONBOARDING_UPLOAD_MB);
/** Raw WebM chunks from MediaRecorder during proctored assessments. */
export const recordingChunk = express.raw({ type: ["video/webm", "application/octet-stream"], limit: `${env.MAX_RECORDING_CHUNK_MB}mb` });

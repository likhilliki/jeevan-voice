import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import voiceRouter from "./voice.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(voiceRouter);

export default router;

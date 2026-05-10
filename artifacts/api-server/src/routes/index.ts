import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auraRouter from "./aura";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auraRouter);

export default router;

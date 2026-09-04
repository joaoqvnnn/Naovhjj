import { Router } from 'express';
import authRoutes from './authRoutes';
import routes from './routes';
import sobreRoutes from './sobreRoutes';

const webRouter = Router();

webRouter.use('/auth', authRoutes);
webRouter.use('/', routes);
webRouter.use('/', sobreRoutes); // adiciona /sobre

export default webRouter;

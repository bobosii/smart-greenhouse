import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { startMqtt } from './mqtt';
import sensorRoutes from './routes/sensors';
import profileRoutes  from './routes/profiles';
import actuatorRoutes, { setMqttClient } from './routes/actuators';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use('/api/sensors', sensorRoutes);
app.use('/api/actuators', actuatorRoutes);
app.use('/api/profiles', profileRoutes);

const mqttClient = startMqtt(io);
setMqttClient(mqttClient);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu calisiyor: http://localhost:${PORT}`));

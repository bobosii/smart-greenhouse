import { Router } from 'express';
import mqtt from 'mqtt';

const router = Router();
let mqttClient: mqtt.MqttClient;

export function setMqttClient(client: mqtt.MqttClient) {
  mqttClient = client;
}

// Manuel kontrol: { "actuator": "pump", "state": true }
router.post('/command', (req, res) => {
  const { actuator, state } = req.body;
  if (!actuator || state === undefined) {
    return res.status(400).json({ error: 'actuator ve state gerekli' });
  }
  mqttClient.publish('sera/001/actuators/command', JSON.stringify({ actuator, state }));
  res.json({ ok: true, actuator, state });
});

export default router;

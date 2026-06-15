import mqtt from 'mqtt';
import dotenv from 'dotenv';
import { pool } from './db';
import { runAutomation } from './automation';
dotenv.config();

export function startMqtt(io: any) {
  const client = mqtt.connect(`mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    rejectUnauthorized: false,
  });

  client.on('connect', () => {
    console.log('MQTT baglandi');
    client.subscribe('sera/001/sensors/telemetry');
  });

  client.on('message', async (_topic: string, message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Veri alindi:', data);

      await pool.query(
        `INSERT INTO sensor_data (device_id, temperature, humidity, soil, light_lux, flow_lpm)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.device_id, data.temperature, data.humidity, data.soil, data.light_lux, data.flow_lpm]
      );

      await runAutomation(data, client);

      io.emit('sensor_data', data);
    } catch (err) {
      console.error('MQTT mesaj hatasi:', err);
    }
  });

  return client;
}

import { pool } from './db';
import mqtt from 'mqtt';

interface SensorData {
  device_id: string;
  temperature: number;
  humidity: number;
  soil: number;
  light_lux: number;
  flow_lpm: number;
}

interface Profile {
  temp_min: number; temp_max: number;
  humidity_min: number; humidity_max: number;
  soil_min: number; soil_max: number;
  light_min: number; light_max: number;
}

// Aktuator son durumlarini tut (gereksiz komut gonderme)
const actuatorStates: Record<string, boolean> = {
  pump: false,
  fan: false,
  light: false,
};

function sendIfChanged(client: mqtt.MqttClient, actuator: string, desired: boolean) {
  if (actuatorStates[actuator] === desired) return;
  actuatorStates[actuator] = desired;
  client.publish(
    'sera/001/actuators/command',
    JSON.stringify({ actuator, state: desired })
  );
  console.log(`[Otomasyon] ${actuator} → ${desired ? 'ACIK' : 'KAPALI'}`);
}

export async function runAutomation(data: SensorData, mqttClient: mqtt.MqttClient) {
  try {
    // Aktif otomasyon kuralini bul
    const ruleRes = await pool.query(
      `SELECT ar.*, pp.*
       FROM automation_rules ar
       JOIN plant_profiles pp ON ar.profile_id = pp.id
       WHERE ar.device_id = $1 AND ar.active = true
       LIMIT 1`,
      [data.device_id]
    );

    if (ruleRes.rows.length === 0) return; // otomasyon aktif degil

    const p: Profile = ruleRes.rows[0];

    // Sulama (Pompa)
    if (data.soil < p.soil_min) {
      sendIfChanged(mqttClient, 'pump', true);   // kuru → pompala
    } else if (data.soil > p.soil_max) {
      sendIfChanged(mqttClient, 'pump', false);  // yeterli → durdur
    }

    // Havalandirma (Fan)
    if (data.temperature > p.temp_max || data.humidity > p.humidity_max) {
      sendIfChanged(mqttClient, 'fan', true);    // sicak/nemli → fani ac
    } else if (data.temperature < p.temp_max - 2 && data.humidity < p.humidity_max - 5) {
      sendIfChanged(mqttClient, 'fan', false);   // normal → fani kapat
    }

    // Aydinlatma (Grow Light)
    if (data.light_lux < p.light_min) {
      sendIfChanged(mqttClient, 'light', true);  // karanlik → isigi ac
    } else if (data.light_lux > p.light_max) {
      sendIfChanged(mqttClient, 'light', false); // yeterli → isigi kapat
    }

  } catch (err) {
    console.error('[Otomasyon] Hata:', err);
  }
}

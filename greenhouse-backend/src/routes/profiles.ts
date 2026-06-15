import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Tum profiller
router.get('/', async (_req, res) => {
  const result = await pool.query('SELECT * FROM plant_profiles ORDER BY id');
  res.json(result.rows);
});

// Profil olustur
router.post('/', async (req, res) => {
  const { name, temp_min, temp_max, humidity_min, humidity_max, soil_min, soil_max, light_min, light_max } = req.body;
  const result = await pool.query(
    `INSERT INTO plant_profiles (name, temp_min, temp_max, humidity_min, humidity_max, soil_min, soil_max, light_min, light_max)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, temp_min, temp_max, humidity_min, humidity_max, soil_min, soil_max, light_min, light_max]
  );
  res.json(result.rows[0]);
});

// Aktif otomasyon durumu
router.get('/automation/:device_id', async (req, res) => {
  const result = await pool.query(
    `SELECT ar.*, pp.name as profile_name
     FROM automation_rules ar
     JOIN plant_profiles pp ON ar.profile_id = pp.id
     WHERE ar.device_id = $1`,
    [req.params.device_id]
  );
  res.json(result.rows[0] || null);
});

// Otomasyonu aktif/pasif yap veya profil degistir
router.post('/automation', async (req, res) => {
  const { device_id, profile_id, active } = req.body;

  const existing = await pool.query(
    'SELECT id FROM automation_rules WHERE device_id = $1', [device_id]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE automation_rules SET profile_id = $1, active = $2 WHERE device_id = $3',
      [profile_id, active, device_id]
    );
  } else {
    await pool.query(
      'INSERT INTO automation_rules (device_id, profile_id, active) VALUES ($1, $2, $3)',
      [device_id, profile_id, active]
    );
  }
  res.json({ ok: true });
});

export default router;

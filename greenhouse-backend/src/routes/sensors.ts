import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Son okuma
router.get('/latest', async (_req, res) => {
  const result = await pool.query(
    `SELECT * FROM sensor_data ORDER BY recorded_at DESC LIMIT 1`
  );
  res.json(result.rows[0] || {});
});

// Son 24 saat geçmiş
router.get('/history', async (req, res) => {
  const hours = req.query.hours || 24;
  const result = await pool.query(
    `SELECT * FROM sensor_data
     WHERE recorded_at > NOW() - INTERVAL '${hours} hours'
     ORDER BY recorded_at ASC`
  );
  res.json(result.rows);
});

export default router;

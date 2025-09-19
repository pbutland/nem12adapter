import express, { Request, Response } from 'express';
import multer from 'multer';
import { detectAdapterAndConvert } from './nem12/convert';
import { Nem12File } from './nem12/types';

const app = express();
const upload = multer();

app.post('/convert-to-nem12', upload.single('datafile'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  try {
  const nem12: Nem12File = await detectAdapterAndConvert(req.file.buffer);
  // Send the serialized NEM12 text
  res.type('text/plain').send(nem12.toString());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NEM12 Adapter server running on port ${PORT}`);
});

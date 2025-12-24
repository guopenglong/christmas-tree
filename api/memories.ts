
import { neon } from '@neondatabase/serverless';

// 这里的 process.env.POSTGRES_URL 会自动读取您在 Vercel 填写的环境变量
const sql = neon(process.env.POSTGRES_URL!);

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      // 从 Neon 获取最近的 50 条记忆
      const result = await sql`SELECT * FROM memories ORDER BY timestamp DESC LIMIT 50`;
      return res.status(200).json(result);
    } 

    if (req.method === 'POST') {
      const { owner, image_data } = req.body;
      
      if (!image_data) return res.status(400).json({ error: 'Missing image data' });

      // 将数据插入 Neon
      await sql`
        INSERT INTO memories (owner, image_data) 
        VALUES (${owner || 'Guest'}, ${image_data})
      `;
      
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

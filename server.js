const express = require('express');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// API de Búsqueda
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        const key = process.env.YOUTUBE_API_KEY;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.items) return res.status(500).json({ error: 'YouTube API error', details: data });

        const tracks = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            cover: item.snippet.thumbnails.high?.url || '',
            type: 'video'
        }));
        res.json({ ok: true, tracks });
    } catch (e) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// API de Descarga (Invocación directa de yt-dlp)
app.get('/api/download', (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    // Invocamos yt-dlp directamente desde el PATH configurado en Render
    const videoUrl = `https://youtube.com/watch?v=${id}`;
    
    // -f bestaudio: formato de audio, -g: URL directa
    exec(`./yt-dlp -f bestaudio -g "${videoUrl}"`, (error, stdout, stderr) => {
        if (error) {
            console.error('yt-dlp error:', stderr);
            return res.status(500).json({ error: 'Download extraction failed', details: stderr });
        }

        const directUrl = stdout.trim();
        
        // Obtenemos los metadatos básicos
        exec(`./yt-dlp --print title --print uploader --print thumbnail "${videoUrl}"`, (infoErr, infoOut) => {
            const [title, artist, cover] = infoOut ? infoOut.trim().split('\n') : ['Unknown', 'Unknown', ''];
            
            res.json({
                ok: true,
                title,
                artist,
                cover,
                directUrl,
                format: 'mp3'
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Calypso Backend running on port ${port}`);
});

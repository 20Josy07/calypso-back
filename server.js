const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// API de Búsqueda (Usa YouTube Data API v3)
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query parameter' });

    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return res.status(500).json({ error: 'YouTube API Key no configurada' });

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.items) return res.status(404).json({ error: 'No results found' });

        const tracks = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url || '',
            type: 'video'
        }));

        res.json({ ok: true, tracks });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// API de Descarga
app.get('/api/download', (req, res) => {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing video ID' });
    }

    // Construimos el comando para yt-dlp con User-Agent para evitar bloqueos 403
    // El comando busca la mejor calidad de audio y obtiene la URL directa
    const ytCommand = `./yt-dlp -f bestaudio -g --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://youtube.com/watch?v=${id}"`;

    exec(ytCommand, (error, stdout, stderr) => {
        if (error) {
            // Fallback: Si yt-dlp falla, devolvemos la URL directa de YouTube
            res.json({
                ok: true,
                directUrl: `https://www.youtube.com/watch?v=${id}`,
                title: 'Video de YouTube',
                artist: 'Artista desconocido',
                cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                format: 'mp3',
                warning: 'Se usó URL de YouTube directa por fallo en la extracción.'
            });
            return;
        }

        const downloadUrl = stdout.trim();

        // Obtenemos metadatos (título, artista, miniatura) en un paso aparte
        const metaCommand = `./yt-dlp --print title --print uploader --print thumbnail "https://youtube.com/watch?v=${id}"`;
        exec(metaCommand, (infoErr, infoOut) => {
            if (infoErr) {
                res.json({
                    ok: true,
                    directUrl: downloadUrl,
                    title: 'Video de YouTube',
                    artist: 'Artista desconocido',
                    cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                    format: 'mp3',
                    warning: 'Metadatos no disponibles.'
                });
                return;
            }

            const [title, artist, cover] = infoOut.trim().split('\n');

            res.json({
                ok: true,
                title,
                artist,
                cover: cover || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                directUrl: downloadUrl,
                format: 'mp3'
            });
        });
    });
});

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({ message: 'Calypso Backend API is running.' });
});

app.listen(port, () => {
    console.log(`Calypso Backend running on port ${port}`);
});

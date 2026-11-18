const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// --- API de Búsqueda ---
// Utiliza la YouTube Data API v3 (requiere YOUTUBE_API_KEY en las variables de entorno de Render)
app.get('/api/search', async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    try {
        const key = process.env.YOUTUBE_API_KEY;
        
        // Verificamos si la clave existe para no romper el despliegue en desarrollo
        if (!key) {
            // Modo sin API key: búsqueda básica por coincidencias de título (limitada)
            // Para producción, asegúrate de tener la YOUTUBE_API_KEY configurada.
            return res.status(500).json({ error: 'YouTube API Key not configured. Please set YOUTUBE_API_KEY in Render environment variables.' });
        }

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${key}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(500).json({ error: 'YouTube API request failed' });
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return res.json({ ok: true, tracks: [] });
        }

        const tracks = data.items.map((item) => ({
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

    // Ejecutamos yt-dlp directamente desde la consola del servidor Render
    // Se usa --user-agent para simular un navegador y evitar el error 403 de YouTube
    const ytArgs = [
        './yt-dlp', 
        '-f', 'bestaudio', 
        '-g', 
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        `https://www.youtube.com/watch?v=${id}`
    ];

    exec(ytArgs.join(' '), (error, stdout, stderr) => {
        if (error) {
            // Si falla el download, probamos con la URL directa simple como fallback
            const fallbackUrl = `https://www.youtube.com/watch?v=${id}`;
            res.json({
                ok: true,
                directUrl: fallbackUrl,
                title: 'Video de YouTube',
                artist: 'Artista desconocido',
                cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                format: 'mp3',
                warning: 'Se usó URL directa de YouTube por fallo en la extracción.'
            });
            return;
        }

        const downloadUrl = stdout.trim();

        // Obtenemos metadatos (título, artista, miniatura) de forma separada para asegurar la respuesta
        exec(`./yt-dlp --print title --print uploader --print thumbnail "./https://youtube.com/watch?v=${id}"`, (infoErr, infoOut) => {
            if (infoErr) {
                // Si falla la obtención de metadatos, usamos valores por defecto
                res.json({
                    ok: true,
                    directUrl: downloadUrl,
                    title: 'Video de YouTube',
                    artist: 'Artista desconocido',
                    cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                    format: 'mp3',
                    warning: 'Metadatos extraídos con éxito, pero no se obtuvieron los detalles completos.'
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

// Ruta de bienvenida (opcional)
app.get('/', (req, res) => {
    res.json({ message: 'Calypso Backend API is running.' });
});

app.listen(port, () => {
    console.log(`Calypso Backend running on port ${port}`);
});

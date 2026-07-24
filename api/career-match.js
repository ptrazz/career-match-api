import OpenAI from "openai"

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "API aktif. Gunakan POST untuk mengirim data.",
        })
    }

    try {
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
            return res.status(500).json({
                error: "OPENAI_API_KEY belum tersedia di Vercel.",
            })
        }

        const openai = new OpenAI({
            apiKey: apiKey,
        })

        const response = await openai.responses.create({
            model: "gpt-5-mini",
            input: "Balas hanya dengan kata: BERHASIL",
        })

        return res.status(200).json({
            status: "success",
            message: response.output_text,
        })

    } catch (error) {
        console.error("ERROR:", error)

        return res.status(500).json({
            error: error.message || "OpenAI gagal dipanggil.",
        })
    }
}

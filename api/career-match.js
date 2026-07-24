import OpenAI from "openai"
import pdf from "pdf-parse"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
    // CORS agar Framer dapat memanggil API
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed",
        })
    }

    try {
        // Membaca multipart/form-data
        const formData = await req.formData()

        const cvFile = formData.get("cv")
        const targetJob = formData.get("targetJob")

        if (!cvFile) {
            return res.status(400).json({
                error: "CV wajib diunggah.",
            })
        }

        if (!targetJob || !String(targetJob).trim()) {
            return res.status(400).json({
                error: "Posisi target wajib diisi.",
            })
        }

        // Batasi ukuran file
        if (cvFile.size > 4 * 1024 * 1024) {
            return res.status(400).json({
                error: "Ukuran CV maksimal 4 MB.",
            })
        }

        const fileBuffer = Buffer.from(await cvFile.arrayBuffer())

        let cvText = ""

        // Saat ini kita fokus mendukung PDF
        if (cvFile.type === "application/pdf") {
            const parsed = await pdf(fileBuffer)
            cvText = parsed.text
        } else {
            return res.status(400).json({
                error: "Untuk versi awal, silakan unggah CV dalam format PDF.",
            })
        }

        if (!cvText.trim()) {
            return res.status(400).json({
                error: "Teks CV tidak dapat dibaca.",
            })
        }

        const prompt = `
Kamu adalah career advisor untuk fresh graduate di Indonesia.

Analisis CV berikut terhadap posisi target.

POSISI TARGET:
${String(targetJob).trim()}

ISI CV:
${cvText}

Berikan analisis dalam JSON dengan format tepat:

{
  "matchScore": number,
  "verdict": "string",
  "summary": "string",
  "recommendedRoles": ["string"]
}

Aturan:
- matchScore harus angka 0 sampai 100.
- verdict harus singkat dan jelas dalam Bahasa Indonesia.
- summary menjelaskan alasan kecocokan secara ringkas.
- recommendedRoles berisi maksimal 5 posisi yang relevan.
- Jangan menggunakan markdown.
- Hanya kembalikan JSON.
`

        const response = await openai.responses.create({
            model: "gpt-5-mini",
            input: prompt,
        })

        const output = response.output_text

        let result

        try {
            result = JSON.parse(output)
        } catch {
            return res.status(500).json({
                error: "AI mengembalikan format hasil yang tidak valid.",
            })
        }

        const matchScore = Number(result.matchScore)

        if (
            !Number.isFinite(matchScore) ||
            matchScore < 0 ||
            matchScore > 100
        ) {
            return res.status(500).json({
                error: "Nilai kecocokan tidak valid.",
            })
        }

        return res.status(200).json({
            matchScore,
            verdict: String(result.verdict || ""),
            summary: String(result.summary || ""),
            recommendedRoles: Array.isArray(result.recommendedRoles)
                ? result.recommendedRoles
                : [],
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            error: "Analisis gagal diproses.",
        })
    }
}

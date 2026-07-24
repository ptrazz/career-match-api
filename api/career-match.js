import OpenAI from "openai"
import pdf from "pdf-parse"

const apiKey = process.env.OPENAI_API_KEY

export default async function handler(req, res) {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // Preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    // Hanya menerima POST
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "API aktif. Gunakan POST untuk mengirim CV.",
        })
    }

    // Cek API key
    if (!apiKey) {
        return res.status(500).json({
            error: "OPENAI_API_KEY belum tersedia di environment server.",
        })
    }

    const openai = new OpenAI({
        apiKey,
    })

    try {
        // Membaca multipart/form-data
        const formData = await req.formData()

        const cvFile = formData.get("cv")
        const targetJob = formData.get("targetJob")

        // Validasi CV
        if (!cvFile) {
            return res.status(400).json({
                error: "CV wajib diunggah.",
            })
        }

        // Validasi posisi target
        if (!targetJob || !String(targetJob).trim()) {
            return res.status(400).json({
                error: "Posisi target wajib diisi.",
            })
        }

        // Validasi ukuran file maksimal 4 MB
        if (cvFile.size > 4 * 1024 * 1024) {
            return res.status(400).json({
                error: "Ukuran CV maksimal 4 MB.",
            })
        }

        // Ambil isi file
        const fileBuffer = Buffer.from(
            await cvFile.arrayBuffer()
        )

        let cvText = ""

        // Hanya PDF untuk versi awal
        if (cvFile.type === "application/pdf") {
            const parsed = await pdf(fileBuffer)
            cvText = parsed.text
        } else {
            return res.status(400).json({
                error: "Untuk versi awal, silakan unggah CV dalam format PDF.",
            })
        }

        // Pastikan PDF memiliki teks
        if (!cvText.trim()) {
            return res.status(400).json({
                error: "Teks CV tidak dapat dibaca.",
            })
        }

        // Prompt untuk AI
        const prompt = `
Kamu adalah career advisor profesional untuk fresh graduate di Indonesia.

Analisis kecocokan CV dengan posisi target berikut.

POSISI TARGET:
${String(targetJob).trim()}

ISI CV:
${cvText}

Berikan hasil analisis dalam format JSON berikut:

{
  "matchScore": 0,
  "verdict": "",
  "summary": "",
  "recommendedRoles": []
}

ATURAN:
- matchScore harus berupa angka antara 0 sampai 100.
- verdict harus singkat dan menggunakan Bahasa Indonesia.
- summary harus menjelaskan alasan kecocokan berdasarkan CV.
- recommendedRoles berisi maksimal 5 posisi pekerjaan yang relevan.
- Jangan menggunakan markdown.
- Jangan menambahkan teks di luar JSON.
- Hanya kembalikan JSON.
`

        // Memanggil OpenAI
        const response = await openai.responses.create({
            model: "gpt-5-mini",
            input: prompt,
        })

        // Ambil hasil AI
        const output = response.output_text

        let result

        try {
            result = JSON.parse(output)
        } catch (parseError) {
            console.error("JSON parsing error:", parseError)

            return res.status(500).json({
                error: "AI mengembalikan format hasil yang tidak valid.",
            })
        }

        // Validasi score
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

        // Kirim hasil ke Framer
        return res.status(200).json({
            matchScore,
            verdict: String(result.verdict || ""),
            summary: String(result.summary || ""),
            recommendedRoles: Array.isArray(
                result.recommendedRoles
            )
                ? result.recommendedRoles
                : [],
        })
    } catch (error) {
        console.error("Career Match API Error:", error)

        return res.status(500).json({
            error:
                error instanceof Error
                    ? error.message
                    : "Analisis gagal diproses.",
        })
    }
}

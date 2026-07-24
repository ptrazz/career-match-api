export default function handler(req, res) {
    return res.status(200).json({
        status: "API BERHASIL BERJALAN",
        message: "Career Match API aktif"
    })
}

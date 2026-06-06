import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const photosSuffixes = ["jpg", "jpeg", "png", "gif"];
        const photosDirectory = path.join(process.cwd(), "public", "photos");

        const files = fs.readdirSync(photosDirectory);
        const photoFiles = files.filter((file) =>
            photosSuffixes.includes(file.split(".").pop())
        );

        const photos = photoFiles.map((fileName) => `/photos/${fileName}`);

        return Response.json({ photos });
    } catch (error) {
        console.error("Error reading photos:", error);

        return Response.json({
            photos: [],
            fallback: true,
            message: "Photos are unavailable right now.",
        });
    }
}

import {readdir} from "node:fs/promises";
import {publicJson} from "@/lib/api-response";
import path from "path";

export const dynamic = "force-static";

export async function GET() {
    const photosSuffixes = ["jpg", "jpeg", "png", "gif"];
    const photosDirectory = path.join(process.cwd(), "public", "photos");

    const files = await readdir(photosDirectory);
    const photoFiles = files.filter((file) =>
        photosSuffixes.includes(file.split(".").pop()?.toLowerCase() ?? "")
    );

    const photos = photoFiles.sort().map((fileName) => `/photos/${encodeURIComponent(fileName)}`);

    return publicJson({photos});
}

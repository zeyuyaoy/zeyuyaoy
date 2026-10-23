import { NextRequest, NextResponse } from "next/server";
import { dump as dumpYaml } from "js-yaml";
import { authorizeAdmin, jsonError, PRIVATE_HEADERS, routeError } from "@/lib/research/api";
import { getDirectorySnapshot } from "@/lib/research/directory";
import { csvCell } from "@/lib/research/exportCsv";

type ExportValue = string | number | boolean;
type ExportRow = Record<string, ExportValue>;

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (auth) {
    return auth;
  }
  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "json").toLowerCase();
    if (!new Set(["json", "csv", "yaml", "yml"]).has(format)) {
      return jsonError("format must be json, csv, yaml, or yml", 400);
    }
    const source = searchParams.get("source");
    if (source && source !== "manual" && source !== "orcid") {
      return jsonError("source must be manual or orcid", 400);
    }
    const tag = searchParams.get("tag")?.trim().toLowerCase();
    const includeClicks = searchParams.get("includeClicks") !== "false";
    const { projects } = await getDirectorySnapshot({ fresh: true });
    const records = projects
      .filter((project) => !source || project.source === source)
      .filter(
        (project) =>
          !tag || project.metadata.tags.some((value) => value.toLowerCase().includes(tag)),
      )
      .sort((a, b) => Date.parse(b.metadata.createdAt) - Date.parse(a.metadata.createdAt))
      .map((project) => ({
        slug: project.slug,
        target: project.target,
        source: project.source,
        ...(includeClicks ? { clicks: project.clicks } : {}),
        ...project.metadata,
      }));
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      const rows: ExportRow[] = records.map((record) => ({
        ...record,
        targetType: record.targetType || "",
        description: record.description || "",
        longDescription: record.longDescription || "",
        tags: record.tags.join(","),
        researchAreas: record.researchAreas.join(","),
        technologies: record.technologies.join(","),
        methods: record.methods.join(","),
        organizations: JSON.stringify(record.organizations),
        collaborators: JSON.stringify(record.collaborators),
        artifacts: JSON.stringify(record.artifacts),
        startDate: record.startDate || "",
        endDate: record.endDate || "",
        githubRepo: record.githubRepo || "",
        photoSetId: record.photoSetId || "",
        updatedAt: record.updatedAt || "",
      }));
      const headers = rows.length
        ? Object.keys(rows[0])
        : [
            "slug",
            "target",
            "source",
            ...(includeClicks ? ["clicks"] : []),
            "targetType",
            "permanent",
            "title",
            "description",
            "longDescription",
            "tags",
            "researchAreas",
            "technologies",
            "methods",
            "organizations",
            "collaborators",
            "artifacts",
            "startDate",
            "endDate",
            "githubRepo",
            "photoSetId",
            "createdAt",
            "updatedAt",
          ];
      const csv = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
      ].join("\n");
      return new NextResponse(csv, {
        headers: {
          ...PRIVATE_HEADERS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="research-export-${date}.csv"`,
        },
      });
    }
    if (format === "yaml" || format === "yml") {
      return new NextResponse(dumpYaml(records, { noRefs: true, lineWidth: 120 }), {
        headers: {
          ...PRIVATE_HEADERS,
          "Content-Type": "application/yaml; charset=utf-8",
          "Content-Disposition": `attachment; filename="research-export-${date}.yaml"`,
        },
      });
    }
    return NextResponse.json(
      {
        export: records,
        metadata: {
          total: records.length,
          generatedAt: new Date().toISOString(),
          format: "json",
          filters: { source: source || "all", tag: tag || null, includeClicks },
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return routeError(error, "GET /api/research/export");
  }
}

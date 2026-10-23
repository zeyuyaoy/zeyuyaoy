# API reference

## Authentication

```bash
curl https://zeyuyaoy.com/api/research/auth \
  -H "x-admin-key: $ADMIN_KEY"
```

## Public discovery

### `GET /api/research/presentation`

Loads the Research homepage pop-up in one request. Returns `availability`, `projects`
(each with public `summary`, `detail`, and optional `photoSet`), and `collections`
with their optional photo sets. This endpoint requires no admin key and never
includes private records or click counters. Responses use `Cache-Control: no-store`.
A missing configuration returns `availability: "unconfigured"`; a temporary service
failure returns HTTP 503 with `availability: "unavailable"`. Configured empty data
returns `availability: "ready"`. Existing ORCID refresh runs after the response
when `ORCID_ID` is configured.

Project presentation links use `/?panel=research&project=<slug>`. Counted artifact
short links remain `/research/<slug>`.

### `GET /api/research/directory`

- `tag`: case-insensitive substring match
- `source`: `manual` or `orcid`
- `limit`: integer from 1–200; default 50
- `offset`: non-negative integer; default 0

```bash
curl "https://zeyuyaoy.com/api/research/directory?tag=genomics&source=manual&limit=20"
```

Each project includes `slug`, `target`, resolved `targetType`, `shortUrl`, both descriptions, tags, research areas, technologies, methods, organizations, collaborators, typed artifacts, source, dates, repository URL, photo-set ID, and timestamps.

### `GET /api/research/search`

```bash
curl "https://zeyuyaoy.com/api/research/search?q=protein&tag=bioinformatics&source=orcid"
```

Search matches titles, descriptions, dates, tags and research areas, organizations, collaborators, methods, technologies, artifact metadata/domains, slug, target, and source. `tag` may be repeated or comma-separated and uses case-insensitive match-all semantics. Optional `year`, `source`, `sort` (`newest`, `oldest`, `title-asc`, or `title-desc`), `limit`, and `offset` parameters are supported. Results add a numeric `score` and plain-text `highlights` arrays.

## Projects

All project routes require authentication.

### Create: `POST /api/research/links`

```bash
curl -X POST https://zeyuyaoy.com/api/research/links \
  -H "content-type: application/json" \
  -H "x-admin-key: $ADMIN_KEY" \
  -d '{
    "slug": "protein-localization",
    "target": "https://example.org/paper",
    "title": "Protein localization study",
    "description": "A concise project summary",
    "longDescription": "A longer account of the research and its results.",
    "tags": ["bioinformatics", "proteomics"],
    "researchAreas": ["computational biology"],
    "methods": ["sequence analysis"],
    "organizations": [{"name": "Example Institute", "role": "Host", "url": "https://example.org"}],
    "artifacts": [{"type": "publication", "title": "Paper", "url": "https://doi.org/10.1000/example", "date": "2025", "venue": "Example Journal", "featured": true}],
    "permanent": true,
    "startDate": "2024-06",
    "endDate": "2025",
    "githubRepo": "https://github.com/example/project",
    "photoSetId": "conference-2025"
  }'
```

`slug` and an HTTP(S) `target` are required. Titles are optional and fall back to the normalized slug; the server does not fetch the target page. A `{ "links": [...] }` body creates multiple projects and returns per-entry results.

Optional `targetType` overrides the primary link's resource type. Accepted values are `publication`, `preprint`, `poster`, `talk`, `presentation`, `award`, `code`, `dataset`, `video`, `file`, `website`, and `other`. These same values are supported for artifact `type`. Invalid primary-link types return `400`.

On creation, an omitted or null `targetType` selects automatic detection. On update, omission preserves the current override and `null` clears it. Authenticated project responses expose this nullable override in `metadata.targetType`; JSON/YAML exports preserve it and CSV uses an empty cell for automatic detection. Public directory/search responses expose the resolved `targetType`: explicit override, matching artifact type, then conservative URL inference. Unknown destinations use `website`.

### Update: `PUT /api/research/links`

Send `slug` and the fields to change. The slug itself is immutable. A project object, an array, or `{ "links": [...] }` is accepted.

For example, `{ "slug": "protein-localization", "targetType": "file" }` sets a link type. `{ "slug": "protein-localization", "githubRepo": "" }` removes only the repository attachment, retaining the project and its primary URL.

### Read: `GET /api/research/links`

- `?slug=<slug>` returns one complete record.
- List mode accepts exact `tag`, `source`, substring `search`, `limit` up to 200, and `offset`.

### Tags on one project: `PATCH /api/research/links`

```json
{
  "slug": "protein-localization",
  "addTags": ["ml"],
  "removeTags": ["draft"]
}
```

### Delete: `DELETE /api/research/links`

Supply `slug`, comma-separated `slugs`, or `tag` in the query or JSON body. Project deletion also removes collection references.

## Collections

All `/api/research/collections` methods require authentication.

- `GET` lists collections.
- `POST` creates `{ id, name, description?, projects?, tags? }`.
- `PUT` updates supplied fields for an existing `id`.
- `PATCH` applies `{ id, addProjects?, removeProjects? }`.
- `DELETE ?id=<id>` removes a collection.

Project arrays are ordered and every referenced slug must exist. Unknown projects are rejected rather than creating disconnected collections.

## Tags

All `/api/research/tags` methods require authentication and reject unknown project slugs.

- `GET ?action=stats` returns tag/source totals.
- `GET ?action=suggest&prefix=bio` returns up to ten suggestions.
- `POST { slugs, tags }` adds tags.
- `PATCH { slugs, tags }` removes tags.
- `PATCH { oldTag, newTag }` renames a tag across projects.
- `DELETE { tag }` removes a tag across projects.

## Analytics

`GET /api/research/stats` requires authentication and returns only metrics supported by the stored data: `totalLinks`, `totalClicks`, `averageClicks`, `uniqueTags`, `sources`, `topProjects`, `topTags`, `tagDistribution`, and `generatedAt`.

Counts are all-time raw successful redirect requests. Historical week/month/year values cannot be reconstructed, so the API does not accept a period parameter.

## Export

`GET /api/research/export` requires authentication. `format` may be `json`, `csv`, or `yaml`; unknown values return `400`. Optional filters are `source`, `tag`, and `includeClicks=false`.

```bash
curl "https://zeyuyaoy.com/api/research/export?format=csv" \
  -H "x-admin-key: $ADMIN_KEY" \
  -o research.csv
```

CSV strings that spreadsheet software could interpret as formulas are prefixed with an inert apostrophe, lists are comma-flattened, and structured entities/artifacts are JSON-encoded inside their cells. JSON and YAML preserve the structured model losslessly.

## Redirects and ORCID

`GET /research/<slug>` increments the all-time count best-effort, sets `noindex` and `no-store`, and returns `308` for permanent projects or `307` otherwise.

Research browsing lives at `/?panel=research`; `/?panel=research&project=<slug>` opens a project detail dialog without incrementing redirect counts. The retired `/research` and `/research/projects/<slug>` pages return 404.

When `ORCID_ID` is configured, the homepage imports public works from ORCID's v3 API. Responses are cached for one hour; malformed works are skipped individually, DOI URLs are normalized safely, and existing Redis metadata is preserved.

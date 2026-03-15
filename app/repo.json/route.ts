import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

const OWNER = "RayaSerahill";
const REPO = "sbjstats";
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

function normalizeVersion(tag: string) {
    return tag.replace(/^v/i, "");
}

export async function GET() {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
        headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 300 },
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: `Failed to fetch latest release from GitHub (${res.status})` },
            { status: 500 }
        );
    }

    const release = await res.json();

    const tag = typeof release.tag_name === "string" ? release.tag_name : "0.0.0";
    const version = normalizeVersion(tag);

    const zipAsset =
        Array.isArray(release.assets)
            ? release.assets.find(
                (asset: any) =>
                    typeof asset?.name === "string" &&
                    asset.name.toLowerCase().endsWith(".zip")
            )
            : null;

    const downloadUrl =
        zipAsset?.browser_download_url ||
        release.zipball_url ||
        `${REPO_URL}/releases/download/${tag}/release.zip`;

    const payload = [
        {
            Author: "Raya Serahill",
            Name: "sbjStats",
            InternalName: "sbjStats",
            AssemblyVersion: `${version}.0`,
            RepoUrl: REPO_URL,
            Description: "Automatically upload SBJ stast to the web interface",
            ApplicableVersion: "any",
            Tags: ["sample", "gamba", "sbj"],
            DalamudApiLevel: 14,
            IsHide: "False",
            IsTestingExclusive: "False",
            DownloadCount: 0,
            LastUpdate: release.published_at ? Date.parse(release.published_at) : 0,
            DownloadLinkInstall: downloadUrl,
            DownloadLinkTesting: downloadUrl,
            DownloadLinkUpdate: downloadUrl,
            LoadRequiredState: 0,
            LoadSync: false,
            CanUnloadAsync: false,
            LoadPriority: 0,
            Punchline: "Automatically upload SBJ stast to the web interface",
            AcceptsFeedback: true,
        },
    ];

    return NextResponse.json(payload);
}
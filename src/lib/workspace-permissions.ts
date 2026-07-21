export type WorkspaceSection = "events" | "catalogue" | "merch" | "information";

type MemberIdentity = { id: number; slug: string };
type WorkspaceOwner = { section: string; catalogueGroup?: string | null; createdBy: number };

export function canManageWorkspaceItem(member: MemberIdentity, item: WorkspaceOwner) {
  if (member.slug === "patrick") return true;
  if (item.section === "information" || item.section === "merch") return false;
  if (item.section === "catalogue" && item.catalogueGroup !== "ideas") return false;
  return member.id === item.createdBy;
}

export function supportsImageGallery(item: Pick<WorkspaceOwner, "section" | "catalogueGroup">) {
  return item.section === "merch" || item.section === "events" || (item.section === "catalogue" && (item.catalogueGroup === "live" || item.catalogueGroup === "upcoming"));
}

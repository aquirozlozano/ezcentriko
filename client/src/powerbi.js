export function parsePowerBiReport(value) {
  if (!value) {
    return { reportId: null, groupId: null, embedUrl: null };
  }

  try {
    const url = new URL(value);
    const reportIdFromQuery = url.searchParams.get("reportId");
    const groupIdFromQuery = url.searchParams.get("groupId");

    if (reportIdFromQuery) {
      return {
        reportId: reportIdFromQuery,
        groupId: groupIdFromQuery,
        embedUrl: value
      };
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const reportsIndex = pathParts.indexOf("reports");
    const groupsIndex = pathParts.indexOf("groups");
    const reportId =
      reportsIndex >= 0 ? pathParts[reportsIndex + 1] : null;
    const groupId = groupsIndex >= 0 ? pathParts[groupsIndex + 1] : null;

    if (!reportId) {
      return { reportId: null, groupId: null, embedUrl: null };
    }

    const embedUrl = new URL("https://app.powerbi.com/reportEmbed");
    embedUrl.searchParams.set("reportId", reportId);
    if (groupId && groupId !== "me") {
      embedUrl.searchParams.set("groupId", groupId);
    }

    return {
      reportId,
      groupId: groupId === "me" ? null : groupId,
      embedUrl: embedUrl.toString()
    };
  } catch (error) {
    return { reportId: null, groupId: null, embedUrl: null };
  }
}

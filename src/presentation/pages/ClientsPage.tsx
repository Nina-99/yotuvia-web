import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
} from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { CLIENTS_PAGE_LIMIT, useCenterClients } from "@/presentation/hooks/use-clients";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber } from "@/presentation/lib/format";

/**
 * Center clients at the app clients route.
 *
 * The API page is fetched through `GetCenterClientsUseCase.execute(centerId,
 * page, limit)`; it exposes no search term, so the free-text box filters the
 * loaded page client-side (documented limitation — the mobile roadmap flags the
 * same gap). All metric columns are server-computed fields of the `Client`
 * entity; nothing is fabricated client-side.
 */
export function ClientsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.clients.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const clientsQuery = useCenterClients(centerId, page);
  const centerQuery = useAdminCenter(centerId);
  const errorMessage = useErrorMessage(clientsQuery.error, "web.errors.clients_fetch");

  const term = search.trim().toLowerCase();
  const data = clientsQuery.data;
  const clients = useMemo(() => data?.data ?? [], [data]);
  const filtered = useMemo(() => {
    if (!term) return clients;
    return clients.filter((client) =>
      [client.firstName, client.lastName, client.email, client.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term)),
    );
  }, [clients, term]);

  const total = data?.total ?? 0;
  const limit = data?.limit ?? CLIENTS_PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeTo = Math.min(page * limit, total);
  const currency = centerQuery.data?.currency ?? "USD";

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.clients.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.clients.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.clients.title")}</h2>
        <p className="text-sm text-text-secondary">{t("web.app.clients.total", { count: total })}</p>
      </div>

      <div className="flex flex-col gap-1 sm:max-w-sm">
        <Input
          type="search"
          label={t("web.app.clients.search_label")}
          placeholder={t("web.app.clients.search_placeholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="text-xs text-text-secondary">{t("web.app.clients.search_scope_hint")}</p>
      </div>

      {clientsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : clientsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.clients.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void clientsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState
              title={t("web.app.clients.empty_title")}
              body={t("web.app.clients.empty_body")}
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-base font-semibold text-text">
              {t("web.app.clients.no_results_title")}
            </p>
            <p className="text-sm text-text-muted">{t("web.app.clients.no_results_body")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">{t("web.app.clients.table_caption")}</caption>
            <thead className="bg-card2 text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.client")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.contact")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.visits")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.spent")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.last_visit")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("web.app.clients.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, index) => (
                <tr
                  key={client.id}
                  className="border-t border-border ytv-stagger"
                  style={{ "--ytv-reveal-delay": `${Math.min(index * 60, 300)}ms` } as CSSProperties}
                >
                  <th scope="row" className="px-3 py-3 font-medium">
                    <span className="block text-text">
                      {`${client.firstName} ${client.lastName}`.trim()}
                    </span>
                    {client.email ? (
                      <span className="block text-xs font-normal text-text-muted">
                        {client.email}
                      </span>
                    ) : null}
                  </th>
                  <td className="px-3 py-3 text-text-muted">{client.phone}</td>
                  <td className="px-3 py-3 text-text">
                    {formatNumber(client.visitsCount, language)}
                  </td>
                  <td className="px-3 py-3 text-text">
                    {formatCurrency(client.totalSpent, language, currency)}
                  </td>
                  <td className="px-3 py-3 text-text-muted">
                    {client.lastVisit
                      ? formatDate(dateKeyFromApi(client.lastVisit), language)
                      : t("web.app.clients.never_visited")}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={client.isActive ? "success" : "default"}>
                      {client.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit ? (
        <nav
          aria-label={t("web.app.clients.pagination.label")}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="text-xs text-text-muted">
            {t("web.app.clients.pagination.showing", {
              from: rangeFrom,
              to: rangeTo,
              total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("web.app.clients.pagination.previous")}
            </Button>
            <span className="text-xs text-text-muted">
              {t("web.app.clients.pagination.page_info", { page, total: totalPages })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {t("web.app.clients.pagination.next")}
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

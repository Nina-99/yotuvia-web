import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Service } from "yotuvia-core";

import { CategoryFormModal, ServiceFormModal } from "@/presentation/components/services";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Select,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useServiceCategories, useServices } from "@/presentation/hooks/use-services";
import {
  useCreateCategory,
  useCreateService,
  useDeleteService,
  useUpdateService,
} from "@/presentation/hooks/use-services-admin";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency } from "@/presentation/lib/format";
import {
  EMPTY_SERVICE_FORM,
  serviceToFormValues,
  toCreateCategoryData,
  toCreateServiceData,
  toUpdateServiceData,
} from "@/presentation/schemas/service.schemas";
import type { CategoryFormValues, ServiceFormValues } from "@/presentation/schemas/service.schemas";

const ALL_CATEGORIES = "all";

type ServiceFormTarget = { mode: "create" } | { mode: "edit"; service: Service };

interface ServiceGroup {
  key: string;
  title: string;
  items: Service[];
}

/**
 * Center service catalog at the app services route.
 *
 * Reads come from `GetServicesUseCase` / `GetCategoriesUseCase`, which map to
 * `GET /services` and `GET /category` — both are paged (100 / 50) and filtered
 * by `beauty_center_id` CLIENT-SIDE inside the core repository, because neither
 * endpoint accepts a center filter yet (the mobile roadmap tracks the same
 * gap). The UI therefore documents that only the first page can be shown, and
 * groups the loaded services by category with an optional category filter.
 *
 * Categories are list + create only: the API exposes `POST /category` and
 * `GET /category` with no update or delete route, so the panel offers exactly
 * those two operations.
 *
 * Not implemented here (no use-case wired in the DI container today):
 * per-service staff assignment (`IPersonnelRepository.getServiceAssignments`)
 * and catalog treatment linking (`treatmentId` is carried by the entity but the
 * treatment catalog picker is a separate slice).
 */
export function ServicesPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.services.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const servicesQuery = useServices(centerId, language);
  const categoriesQuery = useServiceCategories(centerId, language);
  const centerQuery = useAdminCenter(centerId);

  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const createCategory = useCreateCategory();

  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [formTarget, setFormTarget] = useState<ServiceFormTarget | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryErrorKey, setCategoryErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const currency = centerQuery.data?.currency ?? "USD";
  const errorMessage = useErrorMessage(
    servicesQuery.error ?? categoriesQuery.error,
    "web.errors.services_fetch",
  );

  const groups = useMemo<ServiceGroup[]>(() => {
    const namesById = new Map(categories.map((category) => [category.id, category.name]));
    const byCategory = new Map<number, Service[]>();

    for (const service of services) {
      const bucket = byCategory.get(service.categoryId) ?? [];
      bucket.push(service);
      byCategory.set(service.categoryId, bucket);
    }

    return [...byCategory.entries()]
      .map(([categoryId, items]) => ({
        key: String(categoryId),
        title:
          namesById.get(categoryId) ??
          items[0]?.category?.name ??
          t("web.app.services.uncategorized"),
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [services, categories, t]);

  const visibleGroups =
    categoryFilter === ALL_CATEGORIES
      ? groups
      : groups.filter((group) => group.key === categoryFilter);

  const closeForm = () => {
    setFormTarget(null);
    setFormErrorKey(null);
  };

  const openCreate = () => {
    setFormErrorKey(null);
    setFormTarget({ mode: "create" });
  };

  const openEdit = (service: Service) => {
    setFormErrorKey(null);
    setFormTarget({ mode: "edit", service });
  };

  const handleSubmitService = async (values: ServiceFormValues) => {
    setFormErrorKey(null);
    try {
      if (formTarget?.mode === "edit") {
        await updateService.mutateAsync({
          serviceId: formTarget.service.id,
          data: toUpdateServiceData(values),
        });
        toast(t("web.app.services.update_success"), { variant: "success" });
      } else {
        await createService.mutateAsync(toCreateServiceData(values, centerId));
        toast(t("web.app.services.create_success"), { variant: "success" });
      }
      closeForm();
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.services_save"));
    }
  };

  const handleSubmitCategory = async (values: CategoryFormValues) => {
    setCategoryErrorKey(null);
    try {
      await createCategory.mutateAsync(toCreateCategoryData(values, centerId));
      toast(t("web.app.services.category_created"), { variant: "success" });
      setCategoryModalOpen(false);
    } catch (error) {
      setCategoryErrorKey(toErrorKey(error, "web.errors.services_category_create"));
    }
  };

  const handleToggle = async (service: Service) => {
    try {
      await updateService.mutateAsync({
        serviceId: service.id,
        data: { isActive: !(service.isActive ?? false) },
      });
      toast(t("web.app.services.status_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.services_save")), { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deleteService.mutateAsync(deleteTarget.id);
      toast(t("web.app.services.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.services_delete"));
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.services.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.services.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  const defaultCategoryId =
    categoryFilter !== ALL_CATEGORIES
      ? Number(categoryFilter)
      : (categories[0]?.id ?? null);

  const formDefaults: ServiceFormValues =
    formTarget?.mode === "edit"
      ? serviceToFormValues(formTarget.service)
      : { ...EMPTY_SERVICE_FORM, categoryId: defaultCategoryId ? String(defaultCategoryId) : "" };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-text">{t("web.app.services.title")}</h2>
          <p className="text-sm text-text-secondary">
            {t("web.app.services.total", { count: services.length })}
          </p>
        </div>
        <Button onClick={openCreate} disabled={servicesQuery.isPending}>
          {t("web.app.services.new_service")}
        </Button>
      </div>

      <div className="w-full sm:w-72">
        <Select
          label={t("web.app.services.filter.label")}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value={ALL_CATEGORIES}>{t("web.app.services.filter.all")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.services.categories_title")}</CardTitle>
          <CardDescription>{t("web.app.services.categories_body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {categoriesQuery.isPending ? (
            <Skeleton className="h-6 w-48" />
          ) : categories.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.services.categories_empty")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Badge variant="default">{category.name}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              setCategoryErrorKey(null);
              setCategoryModalOpen(true);
            }}
          >
            {t("web.app.services.category_add")}
          </Button>
        </CardContent>
      </Card>

      {servicesQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-20 w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : servicesQuery.isError || categoriesQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.services.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                void servicesQuery.refetch();
                void categoriesQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <EmptyState
              title={t("web.app.services.empty_title")}
              body={t("web.app.services.empty_body")}
              actionLabel={t("web.app.services.empty_cta")}
              onAction={openCreate}
            />
          </CardContent>
        </Card>
      ) : visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-base font-semibold text-text">
              {t("web.app.services.no_results_title")}
            </p>
            <p className="text-sm text-text-muted">{t("web.app.services.no_results_body")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map((group) => {
            const headingId = `services-group-${group.key}`;
            return (
              <section key={group.key} aria-labelledby={headingId} className="flex flex-col gap-3">
                <h3 id={headingId} className="text-lg font-semibold text-text">
                  {group.title}
                </h3>
                <ul className="flex flex-col gap-3">
                  {group.items.map((service, index) => {
                    const active = service.isActive ?? false;
                    return (
                      <li
                        key={service.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center ytv-stagger"
                        style={
                          { "--ytv-reveal-delay": `${Math.min(index * 60, 300)}ms` } as CSSProperties
                        }
                      >
                        {service.imageUrl ? (
                          <img
                            src={service.imageUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-md object-cover"
                          />
                        ) : null}

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-text">
                              {service.name}
                            </span>
                            <Badge variant={active ? "success" : "default"}>
                              {active ? t("common.active") : t("common.inactive")}
                            </Badge>
                          </div>
                          <span className="text-xs text-text-muted">
                            {formatCurrency(service.price, language, currency)}
                            {" · "}
                            {t("web.app.services.duration_value", { minutes: service.duration })}
                          </span>
                          {service.description ? (
                            <p className="text-sm text-text-muted">{service.description}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(service)}
                            aria-label={t("web.app.services.actions.edit_aria", {
                              name: service.name,
                            })}
                          >
                            {t("web.app.services.actions.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleToggle(service)}
                            aria-label={t(
                              active
                                ? "web.app.services.actions.deactivate_aria"
                                : "web.app.services.actions.activate_aria",
                              { name: service.name },
                            )}
                          >
                            {active
                              ? t("web.app.services.actions.deactivate")
                              : t("web.app.services.actions.activate")}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteErrorKey(null);
                              setDeleteTarget(service);
                            }}
                            aria-label={t("web.app.services.actions.delete_aria", {
                              name: service.name,
                            })}
                          >
                            {t("web.app.services.actions.delete")}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {formTarget ? (
        <ServiceFormModal
          mode={formTarget.mode}
          defaultValues={formDefaults}
          categories={categories}
          currency={currency}
          saving={createService.isPending || updateService.isPending}
          errorKey={formErrorKey}
          onClose={closeForm}
          onSubmit={(values) => void handleSubmitService(values)}
        />
      ) : null}

      {categoryModalOpen ? (
        <CategoryFormModal
          saving={createCategory.isPending}
          errorKey={categoryErrorKey}
          onClose={() => setCategoryModalOpen(false)}
          onSubmit={(values) => void handleSubmitCategory(values)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.services.delete_title")}
        description={
          deleteTarget
            ? t("web.app.services.delete_body", { name: deleteTarget.name })
            : undefined
        }
        confirmLabel={t("web.app.services.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deleteService.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

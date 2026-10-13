/* ── Repository ports (interfaces) ── */
import type {
  IAdminCenterRepository,
  IAdminClientRepository,
  IAdminNotificationRepository,
  IAdminReservationRepository,
  IAuthRepository,
  IAvailabilityRepository,
  IBeautyCenterRepository,
  IClientRepository,
  IDashboardRepository,
  IImageRepository,
  INotificationRepository,
  IPersonnelRepository,
  IPostLikeRepository,
  IReservationRepository,
  IReviewRepository,
  ISavedVideoRepository,
  IServiceRepository,
  ISocialMediaRepository,
  IStaffMetricsRepository,
  IStaffNotificationRepository,
  IStaffProfileRepository,
  IStaffReservationRepository,
  IStorageRepository,
  ITreatmentRepository,
  IVideoRepository,
  IVideoWatchEventRepository,
} from "yotuvia-core";

/* ── Repository implementations, use-cases and runtime config ── */
import {
  AcceptInvitationUseCase,
  AddFavoriteUseCase,
  ApiAdminCenterRepository,
  ApiAdminClientRepository,
  ApiAdminNotificationRepository,
  ApiAdminReservationRepository,
  ApiAuthRepository,
  ApiAvailabilityRepository,
  ApiBeautyCenterRepository,
  ApiClientRepository,
  ApiDashboardRepository,
  ApiImageRepository,
  ApiLoyaltyRepository,
  ApiNotificationRepository,
  ApiPersonnelRepository,
  ApiPostLikeRepository,
  ApiReservationRepository,
  ApiReviewRepository,
  ApiSavedVideoRepository,
  ApiServiceRepository,
  ApiSocialMediaRepository,
  ApiStaffMetricsRepository,
  ApiStaffNotificationRepository,
  ApiStaffProfileRepository,
  ApiStaffReservationRepository,
  ApiTreatmentRepository,
  ApiVideoRepository,
  ApiVideoWatchEventRepository,
  ApiWaitlistRepository,
  AssignPersonnelUseCase,
  CancelReservationUseCase,
  Config,
  CountAdminUnreadUseCase,
  CountStaffUnreadUseCase,
  CountUnreadNotificationsUseCase,
  CreateAdminReservationUseCase,
  CreateCategoryUseCase,
  CreateImageUseCase,
  CreatePersonnelUseCase,
  CreateReservationUseCase,
  CreateServiceUseCase,
  DeleteImageUseCase,
  DeletePersonnelUseCase,
  DeleteServiceUseCase,
  FollowPersonnelUseCase,
  ForgotPasswordUseCase,
  GenerateInvitationUseCase,
  GenerateQRUseCase,
  GetAdminCenterUseCase,
  GetAdminNotificationsUseCase,
  GetBeautyCenterUseCase,
  GetBeautyCentersUseCase,
  GetCategoriesUseCase,
  GetCategoryTemplatesUseCase,
  GetCenterClientsUseCase,
  GetCenterReservationsUseCase,
  GetClientFavoritesUseCase,
  GetClientProfileUseCase,
  GetClientReservationsUseCase,
  GetClientServicesUseCase,
  GetDashboardStatsUseCase,
  GetImagesUseCase,
  GetInvitationByTokenUseCase,
  GetNearbyCentersUseCase,
  GetNotificationsUseCase,
  GetPersonalizedFeedUseCase,
  GetPersonnelFeedUseCase,
  GetPersonnelProfileUseCase,
  GetPersonnelUseCase,
  GetReviewsUseCase,
  GetServicesUseCase,
  GetSocialMediaUseCase,
  GetStaffAgendaUseCase,
  GetStaffMetricsUseCase,
  GetStaffNotificationsUseCase,
  GetStaffProfileUseCase,
  GetTopRatedCentersUseCase,
  GetTreatmentCatalogUseCase,
  GetUpcomingReservationUseCase,
  GetVideosFeedUseCase,
  IncrementVideoBookTapsUseCase,
  IncrementVideoViewsUseCase,
  LoginUserUseCase,
  LogoutAllUseCase,
  MarkAdminNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  MarkStaffNotificationReadUseCase,
  MockAuthRepository,
  RecordVideoWatchUseCase,
  RegisterPushDeviceUseCase,
  RegisterUserUseCase,
  RemoveFavoriteUseCase,
  ReorderImagesUseCase,
  ResendVerificationUseCase,
  ResetPasswordUseCase,
  ReviewProofUseCase,
  SearchAvailabilityUseCase,
  SearchBeautyCentersUseCase,
  SocialLoginUseCase,
  ToggleVideoLikeUseCase,
  ToggleVideoSaveUseCase,
  UnfollowPersonnelUseCase,
  UpdateAdminCenterUseCase,
  UpdateImageUseCase,
  UpdatePersonnelUseCase,
  UploadBeautyImageUseCase,
  UploadClientAvatarUseCase,
  UploadStaffImageUseCase,  UpdateReservationStatusUseCase,
  UpdateServiceUseCase,
  UpdateStaffProfileUseCase,
  UpdateStaffReservationStatusUseCase,
  UpsertSocialMediaUseCase,
  VerifyEmailUseCase,
  VerifyQrUseCase,
} from "yotuvia-core";

import { LocalStorageRepository } from "@/data/persistence/LocalStorageRepository";

/* ════════════════════════════════════════════ */
/*  STORAGE                                     */
/* ════════════════════════════════════════════ */

export const storageRepository: IStorageRepository = new LocalStorageRepository();

/* ════════════════════════════════════════════ */
/*  REPOSITORIES                                 */
/* ════════════════════════════════════════════ */

const authRepository: IAuthRepository = Config.useMocks
  ? new MockAuthRepository()
  : new ApiAuthRepository(storageRepository);

const serviceRepository: IServiceRepository = new ApiServiceRepository();
const beautyCenterRepository: IBeautyCenterRepository = new ApiBeautyCenterRepository();
const reservationRepository: IReservationRepository = new ApiReservationRepository();
const waitlistRepository = new ApiWaitlistRepository();
const loyaltyRepository = new ApiLoyaltyRepository();
const adminReservationRepository: IAdminReservationRepository = new ApiAdminReservationRepository();
const adminClientRepository: IAdminClientRepository = new ApiAdminClientRepository();
const videoRepository: IVideoRepository = new ApiVideoRepository();
const postLikeRepository: IPostLikeRepository = new ApiPostLikeRepository();
const savedVideoRepository: ISavedVideoRepository = new ApiSavedVideoRepository();
const videoWatchEventRepository: IVideoWatchEventRepository = new ApiVideoWatchEventRepository();
const clientRepository: IClientRepository = new ApiClientRepository();
const adminCenterRepository: IAdminCenterRepository = new ApiAdminCenterRepository();
const personnelRepository: IPersonnelRepository = new ApiPersonnelRepository();
const reviewRepository: IReviewRepository = new ApiReviewRepository();
const dashboardRepository: IDashboardRepository = new ApiDashboardRepository();
const imageRepository: IImageRepository = new ApiImageRepository();
const socialMediaRepository: ISocialMediaRepository = new ApiSocialMediaRepository();
const staffReservationRepository: IStaffReservationRepository = new ApiStaffReservationRepository();
const staffMetricsRepository: IStaffMetricsRepository = new ApiStaffMetricsRepository();
const staffNotificationRepository: IStaffNotificationRepository = new ApiStaffNotificationRepository();
const staffProfileRepository: IStaffProfileRepository = new ApiStaffProfileRepository();
const adminNotificationRepository: IAdminNotificationRepository = new ApiAdminNotificationRepository();
const notificationRepository: INotificationRepository = new ApiNotificationRepository();
const availabilityRepository: IAvailabilityRepository = new ApiAvailabilityRepository();
const treatmentRepository: ITreatmentRepository = new ApiTreatmentRepository();

/* ════════════════════════════════════════════ */
/*  USE CASES (wired via constructor DI)        */
/* ════════════════════════════════════════════ */

/* ── Auth ── */
export const loginUserUseCase = new LoginUserUseCase(authRepository);
export const registerUserUseCase = new RegisterUserUseCase(authRepository);
export const socialLoginUseCase = new SocialLoginUseCase(authRepository);
export const forgotPasswordUseCase = new ForgotPasswordUseCase(authRepository);
export const resetPasswordUseCase = new ResetPasswordUseCase(authRepository);
export const verifyEmailUseCase = new VerifyEmailUseCase(authRepository);
export const resendVerificationUseCase = new ResendVerificationUseCase(authRepository);
export const logoutAllUseCase = new LogoutAllUseCase(authRepository);

/* ── Services ── */
export const getServicesUseCase = new GetServicesUseCase(serviceRepository);
export const createServiceUseCase = new CreateServiceUseCase(serviceRepository);
export const updateServiceUseCase = new UpdateServiceUseCase(serviceRepository);
export const deleteServiceUseCase = new DeleteServiceUseCase(serviceRepository);
export const getCategoriesUseCase = new GetCategoriesUseCase(serviceRepository);
export const createCategoryUseCase = new CreateCategoryUseCase(serviceRepository);
export const getClientServicesUseCase = new GetClientServicesUseCase(serviceRepository);
export const getCategoryTemplatesUseCase = new GetCategoryTemplatesUseCase(serviceRepository);
export const getTreatmentCatalogUseCase = new GetTreatmentCatalogUseCase(treatmentRepository);

/* ── BeautyCenter ── */
export const getBeautyCentersUseCase = new GetBeautyCentersUseCase(beautyCenterRepository);
export const getBeautyCenterUseCase = new GetBeautyCenterUseCase(beautyCenterRepository);
export const searchBeautyCentersUseCase = new SearchBeautyCentersUseCase(beautyCenterRepository);
export const getTopRatedCentersUseCase = new GetTopRatedCentersUseCase(beautyCenterRepository);
export const getNearbyCentersUseCase = new GetNearbyCentersUseCase(beautyCenterRepository);

/* ── Reservation ── */
export const createReservationUseCase = new CreateReservationUseCase(reservationRepository);
export const getClientReservationsUseCase = new GetClientReservationsUseCase(reservationRepository);
export const generateQRUseCase = new GenerateQRUseCase(reservationRepository);
export const cancelReservationUseCase = new CancelReservationUseCase(reservationRepository);
export const getCenterReservationsUseCase = new GetCenterReservationsUseCase(adminReservationRepository);
export const updateReservationStatusUseCase = new UpdateReservationStatusUseCase(adminReservationRepository);
export const reviewProofUseCase = new ReviewProofUseCase(adminReservationRepository);
export const assignPersonnelUseCase = new AssignPersonnelUseCase(adminReservationRepository);
export const createAdminReservationUseCase = new CreateAdminReservationUseCase(adminReservationRepository);

export const getNotificationsUseCase = new GetNotificationsUseCase(notificationRepository);
export const countUnreadNotificationsUseCase = new CountUnreadNotificationsUseCase(notificationRepository);
export const markNotificationReadUseCase = new MarkNotificationReadUseCase(notificationRepository);
export const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(notificationRepository);
export const registerPushDeviceUseCase = new RegisterPushDeviceUseCase(notificationRepository);

export const getUpcomingReservationUseCase = new GetUpcomingReservationUseCase(reservationRepository);
export const searchAvailabilityUseCase = new SearchAvailabilityUseCase(availabilityRepository);

/* ── Video ── */
export const getVideosFeedUseCase = new GetVideosFeedUseCase(videoRepository);
export const getPersonalizedFeedUseCase = new GetPersonalizedFeedUseCase(videoRepository);
export const getPersonnelFeedUseCase = new GetPersonnelFeedUseCase(videoRepository);
export const incrementVideoViewsUseCase = new IncrementVideoViewsUseCase(videoRepository);
export const incrementVideoBookTapsUseCase = new IncrementVideoBookTapsUseCase(videoRepository);
export const toggleVideoLikeUseCase = new ToggleVideoLikeUseCase(postLikeRepository);
export const toggleVideoSaveUseCase = new ToggleVideoSaveUseCase(savedVideoRepository);
export const recordVideoWatchUseCase = new RecordVideoWatchUseCase(videoWatchEventRepository);

/* ── Client ── */
export const getClientProfileUseCase = new GetClientProfileUseCase(clientRepository);
export const getClientFavoritesUseCase = new GetClientFavoritesUseCase(clientRepository);
export const removeFavoriteUseCase = new RemoveFavoriteUseCase(clientRepository);
export const addFavoriteUseCase = new AddFavoriteUseCase(clientRepository);
export const uploadClientAvatarUseCase = new UploadClientAvatarUseCase(clientRepository);

/* ── Admin Center ── */
export const getAdminCenterUseCase = new GetAdminCenterUseCase(adminCenterRepository);
export const updateAdminCenterUseCase = new UpdateAdminCenterUseCase(adminCenterRepository);

/* ── Admin Clients ── */
export const getCenterClientsUseCase = new GetCenterClientsUseCase(adminClientRepository);

/* ── Personnel ── */
export const getPersonnelUseCase = new GetPersonnelUseCase(personnelRepository);
export const getPersonnelProfileUseCase = new GetPersonnelProfileUseCase(personnelRepository);
export const followPersonnelUseCase = new FollowPersonnelUseCase(personnelRepository);
export const unfollowPersonnelUseCase = new UnfollowPersonnelUseCase(personnelRepository);
export const createPersonnelUseCase = new CreatePersonnelUseCase(personnelRepository);
export const updatePersonnelUseCase = new UpdatePersonnelUseCase(personnelRepository);
export const deletePersonnelUseCase = new DeletePersonnelUseCase(personnelRepository);
export const generateInvitationUseCase = new GenerateInvitationUseCase(personnelRepository);
export const getInvitationByTokenUseCase = new GetInvitationByTokenUseCase(personnelRepository);
export const acceptInvitationUseCase = new AcceptInvitationUseCase(personnelRepository);

/* ── Reviews ── */
export const getReviewsUseCase = new GetReviewsUseCase(reviewRepository);

/* ── Dashboard ── */
export const getDashboardStatsUseCase = new GetDashboardStatsUseCase(dashboardRepository);

/* ── Images ── */
export const getImagesUseCase = new GetImagesUseCase(imageRepository);
export const createImageUseCase = new CreateImageUseCase(imageRepository);
export const updateImageUseCase = new UpdateImageUseCase(imageRepository);
export const reorderImagesUseCase = new ReorderImagesUseCase(imageRepository);
export const deleteImageUseCase = new DeleteImageUseCase(imageRepository);
export const uploadBeautyImageUseCase = new UploadBeautyImageUseCase(imageRepository);

/* ── Social Media ── */
export const getSocialMediaUseCase = new GetSocialMediaUseCase(socialMediaRepository);
export const upsertSocialMediaUseCase = new UpsertSocialMediaUseCase(socialMediaRepository);

/* ── Staff (feat-staff-module PR3) ── */
export const getStaffAgendaUseCase = new GetStaffAgendaUseCase(staffReservationRepository);
export const getStaffMetricsUseCase = new GetStaffMetricsUseCase(staffMetricsRepository);
export const updateStaffReservationStatusUseCase = new UpdateStaffReservationStatusUseCase(staffReservationRepository);
export const verifyQrUseCase = new VerifyQrUseCase(staffReservationRepository);
export const getStaffProfileUseCase = new GetStaffProfileUseCase(staffProfileRepository);
export const updateStaffProfileUseCase = new UpdateStaffProfileUseCase(staffProfileRepository);
export const uploadStaffImageUseCase = new UploadStaffImageUseCase(staffProfileRepository);
export const getStaffNotificationsUseCase = new GetStaffNotificationsUseCase(staffNotificationRepository);
export const countStaffUnreadUseCase = new CountStaffUnreadUseCase(staffNotificationRepository);
export const markStaffNotificationReadUseCase = new MarkStaffNotificationReadUseCase(staffNotificationRepository);

/* ── Admin Notifications (feat-admin-notifications PR3) ── */
export const getAdminNotificationsUseCase = new GetAdminNotificationsUseCase(adminNotificationRepository);
export const countAdminUnreadUseCase = new CountAdminUnreadUseCase(adminNotificationRepository);
export const markAdminNotificationReadUseCase = new MarkAdminNotificationReadUseCase(adminNotificationRepository);

/* ════════════════════════════════════════════ */
/*  AGGREGATED DEPENDENCIES OBJECT              */
/* ════════════════════════════════════════════ */

export const dependencies = {
  /* storage */
  storageRepository,

  /* repositories */
  authRepository,
  serviceRepository,
  beautyCenterRepository,
  reservationRepository,
  waitlistRepository,
  loyaltyRepository,
adminReservationRepository,
  adminClientRepository,
  videoRepository,
  postLikeRepository,
  savedVideoRepository,
  videoWatchEventRepository,
  clientRepository,
  adminCenterRepository,
  personnelRepository,
  reviewRepository,
  dashboardRepository,
  imageRepository,
  socialMediaRepository,
  availabilityRepository,
  treatmentRepository,

  /* use cases — auth */
  loginUserUseCase,
  registerUserUseCase,
  socialLoginUseCase,
  forgotPasswordUseCase,
  resetPasswordUseCase,
  verifyEmailUseCase,
  resendVerificationUseCase,
  logoutAllUseCase,
  getNotificationsUseCase,
  countUnreadNotificationsUseCase,
  markNotificationReadUseCase,
  markAllNotificationsReadUseCase,
  registerPushDeviceUseCase,
  getUpcomingReservationUseCase,
  searchAvailabilityUseCase,

  /* use cases — services */
  getServicesUseCase,
  createServiceUseCase,
  updateServiceUseCase,
  deleteServiceUseCase,
  getCategoriesUseCase,
  createCategoryUseCase,
  getClientServicesUseCase,
  getCategoryTemplatesUseCase,
  getTreatmentCatalogUseCase,

  /* use cases — beauty center */
  getBeautyCentersUseCase,
  getBeautyCenterUseCase,
  searchBeautyCentersUseCase,
  getTopRatedCentersUseCase,
  getNearbyCentersUseCase,

  /* use cases — reservation */
  createReservationUseCase,
  createAdminReservationUseCase,
  getClientReservationsUseCase,
  generateQRUseCase,
  cancelReservationUseCase,
  getCenterReservationsUseCase,
  updateReservationStatusUseCase,
  reviewProofUseCase,
  assignPersonnelUseCase,

  /* use cases — video */
  getVideosFeedUseCase,
  getPersonalizedFeedUseCase,
  getPersonnelFeedUseCase,
  incrementVideoViewsUseCase,
  incrementVideoBookTapsUseCase,
  toggleVideoLikeUseCase,
  toggleVideoSaveUseCase,
  recordVideoWatchUseCase,

  /* use cases — client */
  getClientProfileUseCase,
  getClientFavoritesUseCase,
  removeFavoriteUseCase,
  addFavoriteUseCase,
  uploadClientAvatarUseCase,

  /* use cases — admin center */
  getAdminCenterUseCase,
  updateAdminCenterUseCase,

  /* use cases — admin clients */
  getCenterClientsUseCase,

  /* use cases — personnel */
  getPersonnelUseCase,
  getPersonnelProfileUseCase,
  followPersonnelUseCase,
  unfollowPersonnelUseCase,
  createPersonnelUseCase,
  updatePersonnelUseCase,
  deletePersonnelUseCase,
  generateInvitationUseCase,
  getInvitationByTokenUseCase,
  acceptInvitationUseCase,

  /* use cases — reviews */
  getReviewsUseCase,

  /* use cases — dashboard */
  getDashboardStatsUseCase,

  /* use cases — images */
  getImagesUseCase,
  createImageUseCase,
  updateImageUseCase,
  reorderImagesUseCase,
  deleteImageUseCase,
  uploadBeautyImageUseCase,

  /* use cases — social media */
  getSocialMediaUseCase,
  upsertSocialMediaUseCase,

  /* use cases — staff (feat-staff-module PR3) */
  getStaffAgendaUseCase,
  getStaffMetricsUseCase,
  updateStaffReservationStatusUseCase,
  verifyQrUseCase,
  getStaffProfileUseCase,
  updateStaffProfileUseCase,
  uploadStaffImageUseCase,
  getStaffNotificationsUseCase,
  countStaffUnreadUseCase,
  markStaffNotificationReadUseCase,

  /* use cases — admin notifications (feat-admin-notifications PR3) */
  getAdminNotificationsUseCase,
  countAdminUnreadUseCase,
  markAdminNotificationReadUseCase,
};

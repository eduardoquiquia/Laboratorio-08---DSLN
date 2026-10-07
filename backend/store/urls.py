from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import auth_views as auth, oauth_views, views

router = DefaultRouter()
router.register('products', views.ProductViewSet, basename='products')
router.register('users', views.UserViewSet, basename='users')
router.register('stores', views.StoreViewSet, basename='stores')
urlpatterns = [
    path('', include(router.urls)),
    path('auth/csrf/', auth.CSRFView.as_view()),
    path('auth/login/', auth.LoginView.as_view()),
    path('auth/partial/', auth.PartialView.as_view()),
    path('auth/email/send/', auth.SendVerificationView.as_view()),
    path('auth/email/verify/', auth.VerifyEmailView.as_view()),
    path('auth/mfa/enroll/', auth.EnrollmentView.as_view()),
    path('auth/mfa/verify/', auth.TOTPView.as_view()),
    path('auth/me/', auth.MeView.as_view()),
    path('auth/logout/', auth.LogoutView.as_view()),
    path('auth/oauth/<str:provider>/', oauth_views.oauth_start),
    path('auth/oauth/<str:provider>/callback/', oauth_views.oauth_callback),
    path('dashboard/', views.DashboardView.as_view()),
    path('reports/', views.ReportView.as_view()),
    path('audit/', views.AuditView.as_view()),
]

import React, { useState, useEffect, useCallback } from 'react';
import type { 
  Language, 
  LocationContext, 
  WeatherData, 
  MarketPrice, 
  CropHealth, 
  TodayDecision,
  AlertNotification,
  DesktopNavTab,
  NavTab
} from '../types';
import { TopBar } from '../components/ui/TopBar';
import { DesktopHeader } from '../components/ui/DesktopHeader';
import { TodayDecisionHero } from '../components/agri/TodayDecisionHero';
import { TodayAtAGlance } from '../components/agri/TodayAtAGlance';
import { VoiceActionBar } from '../components/agri/VoiceActionBar';
import { ImportantAlertBanner } from '../components/agri/ImportantAlertBanner';
import { WeatherAdvisoryCard } from '../components/agri/WeatherAdvisoryCard';
import { CropHealthCard } from '../components/agri/CropHealthCard';
import { MandiPriceCard } from '../components/agri/MandiPriceCard';
import { AlertsSection } from '../components/agri/AlertsSection';
import { QuickActions } from '../components/ui/QuickActions';
import { BottomNavigation } from '../components/ui/BottomNavigation';
import { MyFarmView } from '../components/farm/MyFarmView';
import { SevenDayForecastModal } from '../components/weather/SevenDayForecastModal';
import { LocationService } from '../services/location/locationService';
import { WeatherService } from '../services/weather/weatherService';
import { MarketService } from '../services/market/marketService';
import { CropHealthService } from '../services/crop/cropHealthService';
import { DecisionEngine } from '../services/decision/decisionEngine';
import { CacheService } from '../services/cacheService';
import { SupabaseService } from '../services/supabase/supabaseClient';
import { translations } from '../i18n/translations';
import { ArrowLeft } from 'lucide-react';
import { FarmerLoginModal } from '../components/auth/FarmerLoginModal';
import type { FarmerProfile } from '../types';

const SAMPLE_ALERTS: AlertNotification[] = [
  {
    id: 'alert_whitefly_01',
    title: 'Adjoining Mandal Pest Alert',
    description: 'Whitefly & Jassid incidence reported in adjoining Geesugonda & Wardhannapet fields. Regular scouting recommended today.',
    severity: 'warning',
    issuedAt: 'Today, 8:00 AM',
    source: 'PJTSAU Agricultural Extension',
  }
];

export const HomeScreen: React.FC = () => {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [activeMobileTab, setActiveMobileTab] = useState<NavTab>('home');
  const [activeDesktopTab, setActiveDesktopTab] = useState<DesktopNavTab>('home');
  const [location, setLocation] = useState<LocationContext>(LocationService.getDefaultLocation());
  const [isOffline, setIsOffline] = useState<boolean>(!CacheService.isOnline());
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  );

  // Farmer login & identity state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(() => {
    try {
      const saved = localStorage.getItem('ag_active_farmer_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Weather & Mandi state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [show7DayForecastModal, setShow7DayForecastModal] = useState<boolean>(false);

  const [markets, setMarkets] = useState<MarketPrice[]>([]);
  const [marketsLoading, setMarketsLoading] = useState<boolean>(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);

  const [crops, setCrops] = useState<CropHealth[]>(() => CropHealthService.getCropHealthRecordsSync());
  const [decision, setDecision] = useState<TodayDecision>(() => 
    DecisionEngine.generateTodayDecision(null, crops, [])
  );

  const t = translations[currentLang];

  // Load Supabase crop observations & farmer profile on mount
  useEffect(() => {
    let isMounted = true;
    CropHealthService.getCropHealthRecords().then((records) => {
      if (isMounted && records.length > 0) {
        setCrops(records);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Viewport resize listener for adaptive responsive experience
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Real Live Data
  const loadLiveData = useCallback(async (loc: LocationContext) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const weatherResult = await WeatherService.fetchLiveWeather(loc);
      setWeather(weatherResult);
    } catch (e: any) {
      setWeatherError(e.message || 'Failed to load live weather');
    } finally {
      setWeatherLoading(false);
    }

    setMarketsLoading(true);
    setMarketsError(null);
    try {
      const mandiResult = await MarketService.fetchLiveMandiPrices(loc);
      setMarkets(mandiResult);
    } catch (e: any) {
      setMarketsError(e.message || 'Failed to load market rates');
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData(location);
  }, [location, loadLiveData]);

  useEffect(() => {
    const updatedDecision = DecisionEngine.generateTodayDecision(weather, crops, markets);
    setDecision(updatedDecision);
  }, [weather, crops, markets]);

  const handleLocationChange = (newLoc: LocationContext) => {
    setLocation(newLoc);
    LocationService.saveLocation(newLoc);
  };

  const handleToggleDecisionComplete = () => {
    const nextCompleted = !decision.isCompleted;
    setDecision(prev => ({
      ...prev,
      isCompleted: nextCompleted,
    }));
    if (nextCompleted) {
      SupabaseService.logCompletedAction(decision);
    }
  };

  const handleCropUpdate = (updatedCrop: CropHealth) => {
    CropHealthService.updateCropRecord(updatedCrop);
    setCrops(CropHealthService.getCropHealthRecordsSync());
  };

  // Dedicated Tab Navigation Handlers
  const navigateToTab = (tab: DesktopNavTab) => {
    setActiveDesktopTab(tab);
    setActiveMobileTab(tab as NavTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // DESKTOP EXPERIENCE (>= 768px) — REFINED DAILY DECISION CENTER
  // =========================================================================
  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--ag-bg-canvas)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Desktop Header Navigation */}
        <DesktopHeader
          currentLang={currentLang}
          onLanguageChange={setCurrentLang}
          location={location}
          onLocationChange={handleLocationChange}
          isOffline={isOffline}
          activeTab={activeDesktopTab}
          onTabChange={navigateToTab}
          farmerProfile={farmerProfile}
          onOpenLogin={() => setShowLoginModal(true)}
        />

        {/* Main Centered Container */}
        <main className="ag-desktop-container" style={{ maxWidth: '1180px', paddingTop: '28px' }}>
          {activeDesktopTab === 'home' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* 1. Calm Greeting & Farm Context */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                paddingBottom: '4px',
              }}>
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ag-color-primary-dark)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}>
                    {t.greeting}
                  </div>
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: 'var(--ag-color-text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}>
                    {t.heroGreetingSubtitle}
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--ag-color-text-secondary)',
                    fontWeight: 500,
                    marginTop: '4px',
                  }}>
                    {t.farmSummary} • {location.district}, {location.state}
                  </p>
                </div>

                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ag-color-text-secondary)',
                  backgroundColor: '#ECEFE8',
                  padding: '6px 14px',
                  borderRadius: 'var(--ag-radius-full)',
                }}>
                  {new Date().toLocaleDateString(currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>

              {/* 2. Visual Priority: Today Decision Hero + Authentic Farm Visual */}
              <TodayDecisionHero
                decision={decision}
                location={location}
                currentLang={currentLang}
                onToggleComplete={handleToggleDecisionComplete}
                isDesktop={true}
              />

              {/* 3. Today at a Glance (Compact Horizontal Doorways to dedicated features) */}
              <TodayAtAGlance
                weather={weather}
                weatherLoading={weatherLoading}
                markets={markets}
                marketsLoading={marketsLoading}
                crops={crops}
                currentLang={currentLang}
                onNavigateWeather={() => setShow7DayForecastModal(true)}
                onNavigateMandi={() => navigateToTab('mandi')}
                onNavigateDoctor={() => navigateToTab('doctor')}
              />

              {/* 4. Weather Advisory Card (with View 7-Day Forecast action) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                <WeatherAdvisoryCard
                  weather={weather}
                  loading={weatherLoading}
                  error={weatherError}
                  currentLang={currentLang}
                  onOpen7DayForecast={() => setShow7DayForecastModal(true)}
                />

                <MandiPriceCard
                  markets={markets}
                  loading={marketsLoading}
                  error={marketsError}
                  currentLang={currentLang}
                />
              </div>

              {/* 5. Crop Health Overview Card */}
              <CropHealthCard
                crops={crops}
                currentLang={currentLang}
                onCropUpdate={handleCropUpdate}
              />

              {/* 6. Voice Assistant ("Ask AgriGuide" prominent & elegant) */}
              <VoiceActionBar
                currentLang={currentLang}
              />

              {/* 7. Important Alert (Only rendered when real alert exists) */}
              <ImportantAlertBanner
                alerts={SAMPLE_ALERTS}
                currentLang={currentLang}
                onViewAlert={() => navigateToTab('alerts')}
              />
            </div>
          ) : (
            /* Dedicated Screen Views When Navigated From Tabs/Doorways */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <button
                  onClick={() => navigateToTab('home')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: 'var(--ag-radius-md)',
                    backgroundColor: 'var(--ag-color-surface-base)',
                    border: '1px solid var(--ag-border-default)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ag-color-primary-base)',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Home</span>
                </button>
              </div>

              {activeDesktopTab === 'farm' && (
                <MyFarmView
                  currentLang={currentLang}
                  location={location}
                  onNavigateToCropDoctor={() => navigateToTab('doctor')}
                />
              )}

              {activeDesktopTab === 'doctor' && (
                <CropHealthCard
                  crops={crops}
                  currentLang={currentLang}
                  onCropUpdate={handleCropUpdate}
                />
              )}

              {activeDesktopTab === 'mandi' && (
                <MandiPriceCard
                  markets={markets}
                  loading={marketsLoading}
                  error={marketsError}
                  currentLang={currentLang}
                />
              )}

              {activeDesktopTab === 'alerts' && (
                <AlertsSection
                  alerts={SAMPLE_ALERTS}
                  currentLang={currentLang}
                />
              )}

              {activeDesktopTab === 'money' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '14px', color: 'var(--ag-color-text-primary)' }}>
                    Government Schemes & Agricultural Credit
                  </h3>
                  <QuickActions currentLang={currentLang} />
                </div>
              )}
            </div>
          )}
        </main>

        {/* 7-Day Weather Forecast Modal */}
        <SevenDayForecastModal
          isOpen={show7DayForecastModal}
          onClose={() => setShow7DayForecastModal(false)}
          location={location}
          currentWeather={weather}
          currentLang={currentLang}
        />

        {/* Farmer Login / Phone Identity Modal */}
        <FarmerLoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          currentLang={currentLang}
          onSuccess={(profile) => setFarmerProfile(profile)}
        />
      </div>
    );
  }

  // =========================================================================
  // MOBILE EXPERIENCE (< 768px) — THUMB-FRIENDLY DAILY DECISION CENTER
  // =========================================================================
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'var(--ag-bg-canvas)',
      maxWidth: '480px',
      margin: '0 auto',
      position: 'relative',
    }}>
      {/* 1. Mobile Top App Bar */}
      <TopBar
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        location={location}
        onLocationChange={handleLocationChange}
        isOffline={isOffline}
        onNavigateHome={() => setActiveMobileTab('home')}
        farmerProfile={farmerProfile}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* Main Mobile Content */}
      <main style={{ flex: 1, paddingBottom: '88px', paddingLeft: '16px', paddingRight: '16px' }}>
        {activeMobileTab === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingTop: '12px' }}>
            {/* Crisp Decision Focus Question */}
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--ag-color-text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}>
                {t.heroGreetingSubtitle}
              </h2>
            </div>

            {/* 2. Today's Priority Decision */}
            <TodayDecisionHero
              decision={decision}
              location={location}
              currentLang={currentLang}
              onToggleComplete={handleToggleDecisionComplete}
              isDesktop={false}
            />

            {/* 3. Compact Today at a Glance */}
            <TodayAtAGlance
              weather={weather}
              weatherLoading={weatherLoading}
              markets={markets}
              marketsLoading={marketsLoading}
              crops={crops}
              currentLang={currentLang}
              onNavigateWeather={() => setShow7DayForecastModal(true)}
              onNavigateMandi={() => setActiveMobileTab('mandi')}
              onNavigateDoctor={() => setActiveMobileTab('doctor')}
            />

            {/* 4. Weather Advisory Card with 7-Day Forecast Button */}
            <WeatherAdvisoryCard
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              currentLang={currentLang}
              onOpen7DayForecast={() => setShow7DayForecastModal(true)}
            />

            {/* 5. Crop Health Overview */}
            <CropHealthCard
              crops={crops}
              currentLang={currentLang}
              onCropUpdate={handleCropUpdate}
            />

            {/* 6. Mandi Price Card */}
            <MandiPriceCard
              markets={markets}
              loading={marketsLoading}
              error={marketsError}
              currentLang={currentLang}
            />

            {/* 7. Voice Action Assistant */}
            <VoiceActionBar
              currentLang={currentLang}
            />

            {/* 8. Important Alert (if active) */}
            <ImportantAlertBanner
              alerts={SAMPLE_ALERTS}
              currentLang={currentLang}
              onViewAlert={() => setActiveMobileTab('alerts')}
            />
          </div>
        ) : (
          /* Dedicated Mobile Tab Content */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
            <button
              onClick={() => setActiveMobileTab('home')}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: 'var(--ag-radius-sm)',
                backgroundColor: 'var(--ag-color-surface-base)',
                border: '1px solid var(--ag-border-default)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--ag-color-primary-base)',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Decision Center</span>
            </button>

            {activeMobileTab === 'farm' && (
              <MyFarmView
                currentLang={currentLang}
                location={location}
                onNavigateToCropDoctor={() => setActiveMobileTab('doctor')}
              />
            )}

            {activeMobileTab === 'doctor' && (
              <CropHealthCard
                crops={crops}
                currentLang={currentLang}
                onCropUpdate={handleCropUpdate}
              />
            )}

            {activeMobileTab === 'mandi' && (
              <MandiPriceCard
                markets={markets}
                loading={marketsLoading}
                error={marketsError}
                currentLang={currentLang}
              />
            )}

            {activeMobileTab === 'money' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '14px', color: 'var(--ag-color-text-primary)' }}>
                  Government Schemes & Agricultural Credit
                </h3>
                <QuickActions currentLang={currentLang} />
              </div>
            )}

            {activeMobileTab === 'alerts' && (
              <AlertsSection
                alerts={SAMPLE_ALERTS}
                currentLang={currentLang}
              />
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation (4 Core Tabs) */}
      <BottomNavigation
        activeTab={activeMobileTab}
        onTabChange={setActiveMobileTab}
        currentLang={currentLang}
      />

      {/* 7-Day Weather Forecast Modal */}
      <SevenDayForecastModal
        isOpen={show7DayForecastModal}
        onClose={() => setShow7DayForecastModal(false)}
        location={location}
        currentWeather={weather}
        currentLang={currentLang}
      />

      {/* Farmer Login / Phone Identity Modal */}
      <FarmerLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        currentLang={currentLang}
        onSuccess={(profile) => setFarmerProfile(profile)}
      />
    </div>
  );
};

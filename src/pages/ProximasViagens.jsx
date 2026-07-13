import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, ArrowRight, CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTrips } from '../hooks/useTrips';
import whatsappIcon from '../assets/whatsapp.png';
import costaAmalfitana from '../assets/costa_amalfitana.png';

import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';

export default function ProximasViagens() {
  const { settings } = useSettings();
  const { t, language } = useLanguage();
  const [expandedTrips, setExpandedTrips] = useState({});
  const [activeMapImage, setActiveMapImage] = useState(null);

  const toggleTripExpand = (tripId) => {
    setExpandedTrips(prev => ({
      ...prev,
      [tripId]: !prev[tripId]
    }));
  };

  const isCountryRedundant = (country, title) => {
    if (!country || !title) return false;
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return norm(country) === norm(title);
  };
  
  const monthOrder = {
    "Janeiro": 1, "Fevereiro": 2, "Março": 3, "Abril": 4, "Maio": 5, "Junho": 6,
    "Julho": 7, "Agosto": 8, "Setembro": 9, "Outubro": 10, "Novembro": 11, "Dezembro": 12
  };

  const monthTranslations = {
    "Janeiro": "January", "Fevereiro": "February", "Março": "March", "Abril": "April",
    "Maio": "May", "Junho": "June", "Julho": "July", "Agosto": "August",
    "Setembro": "September", "Outubro": "October", "Novembro": "November", "Dezembro": "December"
  };

  const getSortValue = (dateStr) => {
    if (!dateStr) return 0;
    
    const yearMatch = dateStr.match(/\b\d{4}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : 0;
    
    let monthName = "";
    const words = dateStr.split(/\s+/);
    
    // Find the month word
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚçÇ]/g, "");
      if (monthOrder[cleanWord]) {
        monthName = cleanWord;
        break;
      }
    }
    
    const month = monthOrder[monthName] || 0;
    
    // Check if there is a day
    const dayMatch = dateStr.match(/^\d+/);
    const day = dayMatch ? parseInt(dayMatch[0]) : 0;
    
    return year * 372 + month * 31 + day;
  };

  const translateDate = (dateStr) => {
    if (!dateStr) return "";
    if (language === 'pt') return dateStr;
    
    const yearMatch = dateStr.match(/\b\d{4}\b/);
    const year = yearMatch ? yearMatch[0] : "";
    
    const dayMatch = dateStr.match(/^\d+/);
    const day = dayMatch ? dayMatch[0] : "";
    
    let monthPt = "";
    const words = dateStr.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚçÇ]/g, "");
      if (monthOrder[cleanWord]) {
        monthPt = cleanWord;
        break;
      }
    }
    
    const monthEn = monthTranslations[monthPt] || monthPt;
    
    if (day) {
      return `${monthEn} ${day}, ${year}`;
    }
    return `${monthEn} ${year}`;
  };

  const { trips } = useTrips();

  // Ordena as viagens de forma cronológica
  const sortedTrips = [...trips].sort((a, b) => getSortValue(a.date) - getSortValue(b.date));

  const openWhatsApp = (trip) => {
    let text = "";
    if (trip.status === "Esgotado") {
      text = t(
        `Olá! Gostaria de entrar na lista de espera para o grupo de "${trip.title}" (${trip.date}) com a La Dolce Vita.`,
        `Hello! I would like to join the waiting list for the "${t(trip.title)}" group (${translateDate(trip.date)}) with La Dolce Vita.`
      );
    } else {
      text = t(
        `Olá! Tenho interesse em reservar minha vaga no grupo de "${trip.title}" para ${trip.date}. Como posso proceder?`,
        `Hello! I am interested in reserving my spot in the "${t(trip.title)}" group for ${translateDate(trip.date)}. How should I proceed?`
      );
    }
    window.open(`https://wa.me/${settings.whatsapp || '5514999999999'}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="proximas-viagens-page animate-fade-in">
      {/* 1. HERO HEADER BANNER */}
      <section className="viagens-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(26, 38, 29, 0.7) 0%, rgba(26, 38, 29, 0.82) 100%), url(${costaAmalfitana})` }}>
        <div className="container viagens-hero-content text-center">
          <span className="hero-tag-gold">{t("Experiências Compartilhadas", "Shared Experiences")}</span>
          <h1>{t("Próximas Viagens", "Upcoming Trips")}</h1>
          <p>{t("Roteiros exclusivos e curados em pequenos grupos de afinidade. Junte-se a nós em saídas confirmadas para os destinos mais fascinantes.", "Exclusive and curated itineraries in small affinity groups. Join us on confirmed departures to the most fascinating destinations.")}</p>
        </div>
        
        {/* Divisor em Arco Romano */}
        <div className="hero-divider-curve">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,90 Q720,20 1440,90 L1440,120 L0,120 Z" fill="#FAF8F5"></path>
          </svg>
        </div>
      </section>

      {/* 2. CRONOGRAMA DE SAÍDAS */}
      <section className="timeline-section container">
        <div className="timeline-intro text-center reveal">
          <h2>{t("Calendário de Saídas Confirmadas", "Confirmed Departures Calendar")}</h2>
          <p>{t("Encontros sob medida com toda a logística de luxo, hospedagem charmosa e passeios privativos inclusos.", "Tailor-made gatherings with all luxury logistics, charming lodging, and private tours included.")}</p>
        </div>

        <div className="timeline-list">
          {sortedTrips.map((trip) => {
            const dateStr = trip.date || "";
            const isExpanded = !!expandedTrips[trip.id];
            
            // Parse year
            const yearMatch = dateStr.match(/\b\d{4}\b/);
            const yearVal = yearMatch ? yearMatch[0] : "";
            
            // Parse day if any
            const dayMatch = dateStr.match(/^\d+/);
            const dayVal = dayMatch ? dayMatch[0] : "";
            
            // Parse month
            let monthName = "";
            const words = dateStr.split(/\s+/);
            for (const word of words) {
              const cleanWord = word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚçÇ]/g, "");
              if (monthOrder[cleanWord]) {
                monthName = cleanWord;
                break;
              }
            }
            if (!monthName) {
              monthName = words[0] || "";
            }
            
            const translatedMonth = monthTranslations[monthName] || monthName;
            const shortMonth = translatedMonth.substring(0, 3).toUpperCase();
            
            // Definição de cores e porcentagem das vagas preenchidas
            const spotsTotal = trip.spotsTotal;
            const spotsLeft = trip.spotsLeft;
            const hasSpotsInfo = spotsTotal !== null && spotsLeft !== null && spotsTotal > 0;
            const spotsBooked = hasSpotsInfo ? (spotsTotal - spotsLeft) : 0;
            const progressPercent = hasSpotsInfo ? Math.min(100, (spotsBooked / spotsTotal) * 100) : 0;
            
            let statusIcon = <CheckCircle size={16} className="text-green" />;
            let statusClass = "status-aberto";
            let statusText = t("Inscrições Abertas", "Registration Open");

            if (trip.status === "Esgotado") {
              statusIcon = <XCircle size={16} className="text-muted" />;
              statusClass = "status-esgotado";
              statusText = t("Grupo Esgotado", "Group Sold Out");
            } else if (trip.status === "Vagas Limitadas" || (hasSpotsInfo && spotsLeft <= 3)) {
              statusIcon = <AlertCircle size={16} className="text-red" />;
              statusClass = "status-limitado";
              statusText = t("Últimas Vagas!", "Last Spots!");
            }

            const delayClass = `reveal-delay-${(sortedTrips.indexOf(trip) % 3) + 1}`;
            return (
              <div key={trip.id} className={`timeline-item ${trip.status === "Esgotado" ? "item-esgotado" : ""} reveal ${delayClass}`}>
                {/* Coluna 1: Data */}
                <div className="date-column">
                  {dayVal && <span className="date-day" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--color-primary-gold-dark)', lineHeight: 1, display: 'block', marginBottom: '2px' }}>{dayVal}</span>}
                  <span className="date-month" style={dayVal ? { fontSize: '0.85rem', fontWeight: '700', letterSpacing: '0.05em' } : {}}>{shortMonth}</span>
                  <span className="date-year" style={dayVal ? { fontSize: '0.72rem', marginTop: '1px' } : {}}>{yearVal}</span>
                  <div className="date-line-connector"></div>
                </div>

                {/* Coluna 2: Card de Informações */}
                <div className="card-column glass-card">
                  <div className="trip-img-wrapper">
                    <img src={trip.image} alt={t(trip.title)} className="trip-thumb-img" />
                    {trip.status === "Esgotado" && <span className="badge-esgotado-overlay">{t("Esgotado", "Sold Out")}</span>}
                  </div>
                  
                  <div className="trip-details-content">
                    {!isCountryRedundant(trip.country, trip.title) && (
                      <span className="trip-country-tag">{t(trip.country)}</span>
                    )}
                    <h3>{t(trip.title)}</h3>
                    <p className={`trip-summary-desc ${!isExpanded ? 'collapsed' : ''}`}>{t(trip.description)}</p>
                    
                    <div className="trip-meta-info-grid">
                      <div className="meta-info-item">
                        <Clock size={16} className="meta-icon" />
                        <span>{t(trip.duration)}</span>
                      </div>
                      <div className="meta-info-item">
                        <MapPin size={16} className="meta-icon" />
                        <span>{t("Partindo de", "Departing from")} {t(trip.departure)}</span>
                      </div>
                    </div>

                    <div className="trip-route-chips-row">
                      {trip.route.slice(0, 4).map((city, idx) => (
                        <span key={idx} className="timeline-route-chip">{t(city)}</span>
                      ))}
                      {trip.route.length > 4 && <span className="timeline-route-chip-more">+{trip.route.length - 4} {t("mais", "more")}</span>}
                    </div>

                    {!isExpanded && (
                      <button 
                        onClick={() => toggleTripExpand(trip.id)} 
                        className="btn-toggle-details"
                      >
                        <span>{t("Ver Roteiro e Detalhes", "View Itinerary & Details")}</span>
                        <ChevronDown size={16} />
                      </button>
                    )}

                    {isExpanded && (
                      <>
                        {trip.mapImage && (
                          <div className="trip-map-section">
                            <h4 className="map-section-title">
                              {t("Mapa do Roteiro", "Route Map")}
                            </h4>
                            <div className="trip-map-grid">
                              <div className="trip-map-img-container" onClick={() => setActiveMapImage(trip.mapImage)} title={t("Clique para ampliar", "Click to enlarge")}>
                                <img src={trip.mapImage} alt={t(`Mapa de ${trip.title}`, `Map of ${trip.title}`)} className="trip-map-img" />
                              </div>
                              
                              {trip.mapDistances && (
                                <div className="trip-map-distances-box">
                                  <h5 className="distances-title">
                                    📍 {t("Distâncias Aproximadas", "Approximate Distances")}
                                  </h5>
                                  <ul className="distances-list">
                                    {trip.mapDistances.split('\n').map((dist, idx) => dist.trim() && (
                                      <li key={idx} className="distance-item">
                                        <span className="distance-icon">➔</span>
                                        <span className="distance-text">{t(dist.trim())}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {trip.included && (
                          <div className="trip-included-box">
                            <h4 className="included-title">{t("O que está incluso no pacote", "What's included in the package")}</h4>
                            <ul className="included-list">
                              {trip.included.split('\n').map((item, idx) => item.trim() && (
                                <li key={idx} className="included-item">
                                  <span className="included-bullet">✓</span>
                                  <span>{t(item.trim())}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {trip.videoUrl && (
                          <div className="trip-video-section" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed rgba(197, 168, 128, 0.2)' }}>
                            <h4 className="video-section-title" style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-dark-green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                              🎬 {t(trip.videoTitle || "Experiência Exclusiva", "Exclusive Experience")}
                            </h4>
                            <div className="video-wrapper" style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-subtle)', backgroundColor: '#1A261D', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <iframe 
                                src={trip.videoUrl.replace("youtube.com/shorts/", "youtube.com/embed/").replace("?is=", "?si=")} 
                                style={{ 
                                  width: '100%', 
                                  height: trip.videoUrl.includes('shorts') ? '450px' : '315px', 
                                  maxWidth: trip.videoUrl.includes('shorts') ? '255px' : '100%', 
                                  border: 'none' 
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                title={trip.videoTitle || "Video Destino"}
                              ></iframe>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={() => toggleTripExpand(trip.id)} 
                          className="btn-toggle-details"
                          style={{ marginTop: '20px' }}
                        >
                          <span>{t("Recolher Detalhes", "Collapse Details")}</span>
                          <ChevronUp size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Coluna 3: Indicador de Vagas e Ação */}
                <div className="action-column glass-card">
                  <div className="price-box">
                    <span className="price-label">{t("Valor do Roteiro", "Itinerary Value")}</span>
                    {(trip.hidePrice || !trip.price || trip.price.trim() === "") ? (
                      <span className="price-value" style={{ fontSize: '1.45rem', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                        {t("Consulte o valor", "Contact for price")}
                      </span>
                    ) : (
                      <>
                        <span className="price-value">{t(trip.price)}</span>
                        <span className="price-sub">{t("Por pessoa em quarto duplo", "Per person in double room")}</span>
                      </>
                    )}
                  </div>

                  {/* Barra de Progresso de Vagas */}
                  <div className="spots-status-area">
                    <div className="spots-status-text">
                      <div className="status-label">
                        {statusIcon}
                        <span className={`status-badge-text ${statusClass}`}>{statusText}</span>
                      </div>
                      {hasSpotsInfo && (
                        <span className="spots-counter">
                          {trip.status === "Esgotado" ? t("Sem vagas", "No spots") : t(`${trip.spotsLeft} de ${trip.spotsTotal} livres`, `${trip.spotsLeft} of ${trip.spotsTotal} free`)}
                        </span>
                      )}
                    </div>
                    {hasSpotsInfo && (
                      <div className="spots-progress-container">
                        <div 
                          className={`spots-progress-fill ${trip.status === "Esgotado" ? "fill-esgotado" : trip.spotsLeft <= 3 ? "fill-urgente" : "fill-normal"}`} 
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => openWhatsApp(trip)} 
                    className={`btn btn-timeline-cta ${trip.status === "Esgotado" ? "btn-espera" : "btn-reserva"}`}
                  >
                    <img src={whatsappIcon} alt="WhatsApp" className="whatsapp-timeline-icon" />
                    <span>{trip.status === "Esgotado" ? t("Lista de Espera", "Waiting List") : t("Quero Participar", "I Want to Join")}</span>
                    <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. BENEFÍCIOS DOS GRUPOS */}
      <section className="group-benefits-section reveal">
        <div className="container">
          <div className="text-center section-header">
            <span className="section-tag">{t("Diferenciais", "Benefits")}</span>
            <h2 className="section-title">{t("Como funcionam nossos grupos", "How our groups work")}</h2>
          </div>
          <div className="benefits-grid">
            <div className="benefit-card reveal reveal-delay-1">
              <div className="benefit-icon-wrapper">01</div>
              <h4>{t("Grupos Reduzidos", "Small Groups")}</h4>
              <p>{t("Limitamos as saídas a no máximo 10 a 12 pessoas. Isso garante atenção total do guia, flexibilidade nos passeios e maior proximidade.", "We limit departures to a maximum of 10 to 12 people. This guarantees total attention from the guide, flexibility in tours, and closer relationships.")}</p>
            </div>
            <div className="benefit-card reveal reveal-delay-2">
              <div className="benefit-icon-wrapper">02</div>
              <h4>{t("Hospedagem Charmosa", "Charming Lodging")}</h4>
              <p>{t("Priorizamos hotéis boutique locais, vilas históricas e estalagens repletas de história que oferecem charme e conforto no lugar de redes de hotéis padronizadas.", "We prioritize local boutique hotels, historic villas, and inns full of history that offer charm and comfort instead of standardized hotel chains.")}</p>
            </div>
            <div className="benefit-card reveal reveal-delay-3">
              <div className="benefit-icon-wrapper">03</div>
              <h4>{t("Experiências Fora do Roteiro", "Off-the-Beaten-Path Experiences")}</h4>
              <p>{t("Nossos guias locais abrem portas para vinícolas secretas, oficinas de artesãos locais e almoços em casas de família exclusivos do nosso grupo.", "Our local guides open doors to secret wineries, local artisan workshops, and lunches in family homes exclusive to our group.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* LIGHTBOX DE EXPANSÃO DO MAPA */}
      {activeMapImage && (
        <div className="map-lightbox-backdrop" onClick={() => setActiveMapImage(null)}>
          <div className="map-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="map-lightbox-close" onClick={() => setActiveMapImage(null)} title={t("Fechar", "Close")}>
              <XCircle size={32} />
            </button>
            <img src={activeMapImage} alt={t("Mapa do Roteiro Expandido", "Expanded Route Map")} className="map-lightbox-img" />
          </div>
        </div>
      )}

      {/* ESTILOS DA PÁGINA */}
      <style>{`
        .proximas-viagens-page {
          padding-bottom: 80px;
          background-color: var(--color-bg-light);
        }

        /* 1. HERO BANNER */
        .viagens-hero {
          background-size: cover;
          background-position: center;
          height: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding-top: var(--header-height);
        }

        .viagens-hero-content {
          max-width: 850px;
          z-index: 10;
        }

        .hero-tag-gold {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-primary-gold);
          display: inline-block;
          margin-bottom: 12px;
        }

        .viagens-hero-content h1 {
          font-family: var(--font-title);
          font-size: 4.5rem;
          color: #FFFFFF;
          font-weight: 400;
          margin-bottom: 16px;
          text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        }

        .viagens-hero-content p {
          color: rgba(255, 255, 255, 0.95);
          font-size: 1.25rem;
          line-height: 1.6;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }

        /* Divisor em Arco Romano */
        .hero-divider-curve {
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 60px;
          z-index: 15;
          pointer-events: none;
        }

        .hero-divider-curve svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* 2. TIMELINE SECTION */
        .timeline-section {
          margin-top: 60px;
          margin-bottom: 80px;
        }

        .timeline-intro {
          max-width: 700px;
          margin: 0 auto 60px auto;
        }

        .timeline-intro h2 {
          font-family: var(--font-title);
          font-size: 2.8rem;
          color: var(--color-dark-green);
          margin-bottom: 12px;
          font-weight: 400;
        }

        .timeline-intro p {
          font-size: 1.05rem;
          color: var(--color-text-muted);
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 40px;
          position: relative;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 100px 1.8fr 1fr;
          gap: 30px;
          position: relative;
        }

        /* Coluna 1: Data */
        .date-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 24px;
          position: relative;
        }

        .date-month {
          font-family: var(--font-title);
          font-size: 2.2rem;
          color: var(--color-primary-gold-dark);
          line-height: 1;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .date-year {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--color-text-muted);
          margin-top: 4px;
        }

        .date-line-connector {
          width: 1px;
          flex-grow: 1;
          background-color: var(--color-primary-gold-light);
          margin-top: 20px;
          opacity: 0.5;
        }

        .timeline-item:last-child .date-line-connector {
          display: none; /* Não exibe o conector no último item */
        }

        /* Coluna 2: Card de Detalhes */
        .card-column {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: var(--color-bg-white);
          border-radius: 4px;
          box-shadow: var(--shadow-subtle);
          border: 1px solid rgba(197, 168, 128, 0.1);
          transition: var(--transition-smooth);
        }

        .timeline-item:hover .card-column {
          transform: translateY(-4px);
          box-shadow: var(--shadow-medium);
          border-color: rgba(197, 168, 128, 0.25);
        }

        .trip-img-wrapper {
          position: relative;
          width: 100%;
          height: 240px;
          overflow: hidden;
        }

        .trip-thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 1.2s ease;
        }

        .timeline-item:hover .trip-thumb-img {
          transform: scale(1.08);
        }

        .badge-esgotado-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(26, 38, 29, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          backdrop-filter: blur(2px);
        }

        .trip-details-content {
          padding: 24px 30px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .trip-country-tag {
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-primary-gold-dark);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 6px;
        }

        .trip-details-content h3 {
          font-family: var(--font-title);
          font-size: 2rem;
          color: var(--color-dark-green);
          font-weight: 400;
          margin-bottom: 8px;
        }

        .trip-summary-desc {
          font-size: 0.88rem;
          color: var(--color-text-muted);
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .trip-summary-desc.collapsed {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .btn-toggle-details {
          background: none;
          border: none;
          color: var(--color-primary-gold-dark);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 8px 0;
          margin-top: 14px;
          margin-bottom: 4px;
          transition: color 0.2s;
          align-self: flex-start;
        }

        .btn-toggle-details:hover {
          color: var(--color-dark-green);
        }

        .trip-meta-info-grid {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }

        .meta-info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }

        .meta-icon {
          color: var(--color-primary-gold-dark);
        }

        .trip-route-chips-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .timeline-route-chip {
          background-color: var(--color-bg-light);
          color: var(--color-dark-green);
          font-family: var(--font-body);
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 30px;
          border: 1px solid rgba(197, 168, 128, 0.1);
        }

        .timeline-route-chip-more {
          color: var(--color-primary-gold-dark);
          font-family: var(--font-body);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 6px;
          align-self: center;
        }

        .trip-map-section {
          margin-top: 24px;
          margin-bottom: 24px;
          padding-top: 20px;
          border-top: 1px dashed rgba(197, 168, 128, 0.2);
        }

        .map-section-title {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-dark-green);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
        }

        .trip-map-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          align-items: start;
        }

        .trip-map-img-container {
          width: 100%;
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          border: 1px solid rgba(197, 168, 128, 0.3);
          box-shadow: var(--shadow-subtle);
          transition: var(--transition-smooth);
          cursor: zoom-in;
        }

        .trip-map-img-container:hover {
          box-shadow: var(--shadow-medium);
          border-color: var(--color-primary-gold);
        }

        .trip-map-img {
          width: 100%;
          height: auto;
          display: block;
          max-height: 280px;
          object-fit: cover;
          transition: transform var(--transition-smooth);
        }

        .trip-map-img-container:hover .trip-map-img {
          transform: scale(1.02);
        }

        .trip-map-distances-box {
          background-color: var(--color-bg-cream);
          padding: 20px;
          border-radius: var(--border-radius-sm);
          border-left: 3px solid var(--color-primary-gold);
          box-shadow: var(--shadow-subtle);
        }

        .distances-title {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-dark-green-dark);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(197, 168, 128, 0.2);
          padding-bottom: 8px;
        }

        .distances-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .distance-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .distance-icon {
          color: var(--color-primary-gold-dark);
          font-weight: bold;
        }

        .distance-text {
          line-height: 1.4;
        }

        @media (max-width: 768px) {
          .trip-map-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        /* LIGHTBOX PARA MAPA EXPANDIDO */
        .map-lightbox-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(26, 38, 29, 0.9);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          cursor: zoom-out;
        }

        .map-lightbox-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: default;
        }

        .map-lightbox-close {
          position: absolute;
          top: -45px;
          right: 0;
          background: none;
          border: none;
          color: #FFFFFF;
          cursor: pointer;
          transition: transform 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .map-lightbox-close:hover {
          color: var(--color-primary-gold);
          transform: scale(1.15);
        }

        .map-lightbox-img {
          max-width: 100%;
          max-height: 85vh;
          object-fit: contain;
          border-radius: var(--border-radius-sm);
          border: 2px solid rgba(197, 168, 128, 0.4);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          animation: zoom-in-fade 0.3s ease-out;
        }

        @keyframes zoom-in-fade {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .trip-included-box {
          margin-top: 16px;
          padding: 14px 18px;
          background-color: var(--color-bg-cream);
          border-left: 3px solid var(--color-primary-gold);
          border-radius: 4px;
        }

        .included-title {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-dark-green);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .included-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 8px 16px;
        }

        .included-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 0.82rem;
          color: var(--color-text-muted);
          line-height: 1.4;
        }

        .included-bullet {
          color: var(--color-primary-gold-dark);
          font-weight: bold;
          font-size: 0.85rem;
        }

        /* Coluna 3: Ação e Preços */
        .action-column {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 20px;
          align-self: start;
          padding: 24px 30px;
          background-color: var(--color-bg-white);
          border-radius: 4px;
          box-shadow: var(--shadow-subtle);
          border: 1px solid rgba(197, 168, 128, 0.1);
          transition: var(--transition-smooth);
        }

        .timeline-item:hover .action-column {
          transform: translateY(-4px);
          box-shadow: var(--shadow-medium);
          border-color: rgba(197, 168, 128, 0.25);
        }

        .price-box {
          display: flex;
          flex-direction: column;
        }

        .price-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 2px;
        }

        .price-value {
          font-family: var(--font-title);
          font-size: 2.2rem;
          color: var(--color-dark-green-dark);
          line-height: 1.1;
          font-weight: 500;
        }

        .price-sub {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        /* Progresso das Vagas */
        .spots-status-area {
          margin: 16px 0;
        }

        .spots-status-text {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          font-size: 0.8rem;
        }

        .status-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-badge-text {
          font-weight: 700;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-aberto { color: #2C3D30; }
        .status-limitado { color: var(--color-accent-red); }
        .status-esgotado { color: var(--color-text-muted); }

        .spots-counter {
          color: var(--color-text-muted);
          font-weight: 600;
        }

        .spots-progress-container {
          width: 100%;
          height: 6px;
          background-color: var(--color-bg-cream);
          border-radius: 30px;
          overflow: hidden;
        }

        .spots-progress-fill {
          height: 100%;
          border-radius: 30px;
          transition: width 1s ease-in-out;
        }

        .fill-normal { background-color: var(--color-primary-gold); }
        .fill-urgente { background-color: var(--color-accent-red); }
        .fill-esgotado { background-color: var(--color-text-muted); opacity: 0.3; }

        /* Botão CTA */
        .btn-timeline-cta {
          width: 100%;
          justify-content: center;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          padding: 12px 20px;
          border-radius: var(--border-radius-sm);
        }

        .btn-reserva {
          background-color: var(--color-dark-green);
          color: #FFFFFF;
          border-color: var(--color-dark-green);
        }

        .btn-reserva:hover {
          background-color: var(--color-primary-gold);
          border-color: var(--color-primary-gold);
          color: var(--color-dark-green-dark);
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(197, 168, 128, 0.3);
        }

        .btn-espera {
          background-color: transparent;
          color: var(--color-text-muted);
          border: 1px solid var(--color-text-muted);
        }

        .btn-espera:hover {
          background-color: var(--color-text-muted);
          color: #FFFFFF;
          transform: translateY(-2px);
        }

        .whatsapp-timeline-icon {
          width: 16px;
          height: 16px;
          margin-right: 8px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        .btn-espera:hover .whatsapp-timeline-icon {
          filter: brightness(0) invert(1);
        }

        .btn-reserva:hover .whatsapp-timeline-icon {
          filter: brightness(0);
        }

        /* Estilos de Esgotado */
        .item-esgotado {
          opacity: 0.8;
        }
        
        .item-esgotado .card-column {
          border-color: rgba(0,0,0,0.05);
        }

        /* 3. BENEFICIOS SECT */
        .group-benefits-section {
          background-color: var(--color-bg-cream);
          padding: 80px 0;
          border-top: 1px solid var(--glass-border);
        }

        .section-header {
          margin-bottom: 50px;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }

        .benefit-card {
          background-color: var(--color-bg-light);
          padding: 40px 30px;
          border-radius: 4px;
          border: 1px solid rgba(197, 168, 128, 0.15);
          box-shadow: var(--shadow-subtle);
          transition: var(--transition-smooth);
        }

        .benefit-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-medium);
          border-color: var(--color-primary-gold);
        }

        .benefit-icon-wrapper {
          font-family: var(--font-title);
          font-size: 2.5rem;
          color: var(--color-primary-gold-dark);
          line-height: 1;
          margin-bottom: 20px;
          font-weight: 300;
        }

        .benefit-card h4 {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-dark-green);
          margin-bottom: 12px;
        }

        .benefit-card p {
          font-size: 0.85rem;
          line-height: 1.6;
          color: var(--color-text-muted);
        }

        /* Cores Auxiliares */
        .text-green { color: #2C3D30; }
        .text-red { color: var(--color-accent-red); }
        .text-muted { color: var(--color-text-muted); }

        /* RESPONSIVIDADE */
        @media (max-width: 1100px) {
          .timeline-item {
            grid-template-columns: 80px 1.5fr 1fr;
            gap: 20px;
          }
          .card-column {
            grid-template-columns: 180px 1fr;
          }
        }

        @media (max-width: 992px) {
          .timeline-item {
            grid-template-columns: 1fr;
            gap: 15px;
            border-bottom: 1px solid rgba(197, 168, 128, 0.15);
            padding-bottom: 40px;
          }

          .date-column {
            flex-direction: row;
            gap: 12px;
            align-items: center;
            padding-top: 0;
            justify-content: flex-start;
          }

          .date-line-connector {
            display: none !important;
          }

          .card-column {
            grid-template-columns: 1fr;
          }

          .trip-img-wrapper {
            height: 200px;
          }

          .action-column {
            gap: 20px;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .viagens-hero-content h1 {
            font-size: 3.5rem;
          }
        }

        @media (max-width: 768px) {
          .viagens-hero {
            height: 380px;
          }
          .hero-divider-curve {
            height: 30px;
          }
          .viagens-hero-content h1 {
            font-size: 2.8rem;
          }
          .viagens-hero-content p {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
}

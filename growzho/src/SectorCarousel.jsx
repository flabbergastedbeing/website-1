import { useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, EffectCoverflow, Keyboard } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-coverflow'

/**
 * The Specialisation cards as a coverflow carousel: infinite loop, auto-rotating, pauses while the pointer is over it.
 * Swiper's loop mode needs more slides than are visible at once, so the cards are repeated once (the repeat is hidden
 * from assistive tech and the dots still map back to the original cards).
 */
export default function SectorCarousel({ items, renderCard, autoplay = true }) {
  const n = items.length
  const slides = [...items, ...items]
  const swiperRef = useRef(null)
  const [active, setActive] = useState(0)

  return (
    <div className="sector-carousel">
      <Swiper
        modules={[EffectCoverflow, Autoplay, Keyboard]}
        onSwiper={(s) => { swiperRef.current = s }}
        onSlideChange={(s) => setActive(s.realIndex % n)}
        effect="coverflow"
        coverflowEffect={{ rotate: 40, stretch: 0, depth: 100, modifier: 1, slideShadows: true }}
        centeredSlides
        slidesPerView="auto"
        spaceBetween={0}
        loop
        speed={900}
        grabCursor
        slideToClickedSlide
        keyboard={{ enabled: true }}
        autoplay={autoplay ? { delay: 3200, disableOnInteraction: false, pauseOnMouseEnter: true } : false}
        className="sector-swiper"
      >
        {slides.map((x, i) => (
          <SwiperSlide key={`${x.n}-${i}`} aria-hidden={i >= n ? 'true' : undefined}>
            {renderCard(x)}
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="sector-dots" role="group" aria-label="Choose a sector">
        {items.map((x, i) => (
          <button
            key={x.n}
            type="button"
            className={i === active ? 'on' : ''}
            aria-label={`Show ${x.title}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => swiperRef.current?.slideToLoop(i)}
          />
        ))}
      </div>
    </div>
  )
}
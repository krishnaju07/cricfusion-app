import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'

export default function ChannelCard({ channel, index = 0 }) {
  const navigate   = useNavigate()
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div
      className="card-appear cursor-pointer rounded-2xl overflow-hidden bg-[#141414] border border-white/[0.06]"
      style={{
        animationDelay: `${Math.min(index, 10) * 0.04}s`,
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={() => navigate(`/watch/${channel.id}`)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden aspect-video">
        {imgFailed || !channel.thumbnail ? (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-white/20 font-black text-2xl">{channel.logo}</span>
          </div>
        ) : (
          <img
            src={channel.thumbnail}
            alt={channel.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Quality badge */}
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
            channel.badge === '4K' ? 'bg-purple-600 text-white' :
            channel.badge === 'HD' ? 'bg-blue-600/90 text-white' :
            'bg-black/60 text-white/70'
          }`}>
            {channel.badge}
          </span>
        </div>

        {channel.score && (
          <div className="absolute bottom-2 left-3 right-3">
            <span className="text-white/80 text-xs font-medium line-clamp-1">{channel.score}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-white font-semibold text-sm leading-snug line-clamp-2">
          {channel.currentMatch}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/35 text-xs truncate">{channel.name}</span>
          {channel.viewers && channel.viewers !== '—' && (
            <div className="flex items-center gap-1 text-white/30 text-xs flex-shrink-0">
              <Users size={10} />
              <span>{channel.viewers}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

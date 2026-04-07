import React from 'react'
import { Bird, Power } from 'lucide-react'

  // A screen to show when the TPA server is not connected
function TpaConnectionError() {
  return (
    <div className="relative h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex items-center justify-center p-4 pt-[36px]">
        {/* Background words */}
        <div className="absolute inset-0 select-none pointer-events-none">
          <div className="absolute top-8 left-4 sm:left-16 text-slate-700 opacity-30 text-lg sm:text-2xl transform rotate-12">Hello</div>
          <div className="absolute top-24 right-4 sm:right-12 text-slate-800 opacity-25 text-base sm:text-xl transform -rotate-6">Bonjour</div>
          <div className="absolute top-12 right-20 sm:right-32 text-slate-700 opacity-30 text-lg sm:text-2xl transform rotate-45">こんにちは</div>
          <div className="absolute top-48 left-2 sm:left-8 text-slate-700 opacity-20 text-lg sm:text-2xl transform -rotate-12">Hola</div>
          <div className="absolute bottom-32 right-8 sm:right-16 text-slate-800 opacity-30 text-base sm:text-xl transform rotate-30">Guten Tag</div>
          <div className="absolute bottom-16 left-12 sm:left-24 text-slate-700 opacity-25 text-lg sm:text-2xl transform -rotate-20">Ciao</div>
          <div className="absolute top-64 right-24 sm:right-48 text-slate-800 opacity-30 text-base sm:text-xl transform rotate-15">Привет</div>
          <div className="absolute bottom-48 left-24 sm:left-48 text-slate-800 opacity-20 text-lg sm:text-2xl transform -rotate-30">नमस्ते</div>
          <div className="absolute top-32 left-20 sm:left-40 text-slate-800 opacity-25 text-base sm:text-xl transform rotate-60">Salaam</div>
          <div className="absolute bottom-24 right-20 sm:right-40 text-slate-700 opacity-30 text-base sm:text-xl transform -rotate-45">Shalom</div>
          <div className="absolute top-4 right-32 sm:right-64 text-slate-800 opacity-30 text-lg sm:text-2xl transform rotate-20">你好</div>
          <div className="absolute bottom-8 left-4 sm:left-12 text-slate-800 opacity-20 text-lg sm:text-2xl transform rotate-35">Olá</div>
          <div className="absolute top-56 left-32 sm:left-64 text-slate-800 opacity-25 text-base sm:text-xl transform -rotate-25">Jambo</div>
          <div className="absolute bottom-56 right-12 sm:right-24 text-slate-800 opacity-30 text-lg sm:text-2xl transform rotate-50">Marhaba</div>
        </div>

        {/* Center content */}
        <div className="text-center z-10 max-w-md mx-auto">
          {/* Icon container with gradient background */}
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl rounded-full"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-full p-6">
              <Bird className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-slate-400" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-200 mb-4">App Not Online</h2>

          <p className="text-slate-400 text-sm sm:text-base mb-6 px-4">
            The translation service is currently offline. Please start the app in MentraOS to begin translating.
          </p>

          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-lg p-4 mx-4">
            <div className="flex items-center justify-center gap-2 text-slate-300 text-xs sm:text-sm">
              <Power className="w-4 h-4 text-blue-400" />
              <span>Toggle the start button in MentraOS</span>
            </div>
          </div>
        </div>
      </div>
    )
}

export default TpaConnectionError
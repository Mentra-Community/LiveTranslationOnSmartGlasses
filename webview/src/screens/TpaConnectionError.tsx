import React from 'react'
import { Bird, Power } from 'lucide-react'

  // A screen to show when the TPA server is not connected
function TpaConnectionError() {
  return (
    <div className="relative h-screen w-full bg-[#F2F2F2] overflow-hidden flex items-center justify-center p-4">
        {/* Background words */}
        <div className="absolute inset-0 select-none pointer-events-none">
          <div className="absolute top-8 left-4 sm:left-16 text-gray-300 opacity-40 text-lg sm:text-2xl transform rotate-12">Hello</div>
          <div className="absolute top-24 right-4 sm:right-12 text-gray-300 opacity-35 text-base sm:text-xl transform -rotate-6">Bonjour</div>
          <div className="absolute top-12 right-20 sm:right-32 text-gray-300 opacity-40 text-lg sm:text-2xl transform rotate-45">こんにちは</div>
          <div className="absolute top-48 left-2 sm:left-8 text-gray-300 opacity-30 text-lg sm:text-2xl transform -rotate-12">Hola</div>
          <div className="absolute bottom-32 right-8 sm:right-16 text-gray-300 opacity-40 text-base sm:text-xl transform rotate-30">Guten Tag</div>
          <div className="absolute bottom-16 left-12 sm:left-24 text-gray-300 opacity-35 text-lg sm:text-2xl transform -rotate-20">Ciao</div>
          <div className="absolute top-64 right-24 sm:right-48 text-gray-300 opacity-40 text-base sm:text-xl transform rotate-15">Привет</div>
          <div className="absolute bottom-48 left-24 sm:left-48 text-gray-300 opacity-30 text-lg sm:text-2xl transform -rotate-30">नमस्ते</div>
          <div className="absolute top-32 left-20 sm:left-40 text-gray-300 opacity-35 text-base sm:text-xl transform rotate-60">Salaam</div>
          <div className="absolute bottom-24 right-20 sm:right-40 text-gray-300 opacity-40 text-base sm:text-xl transform -rotate-45">Shalom</div>
          <div className="absolute top-4 right-32 sm:right-64 text-gray-300 opacity-40 text-lg sm:text-2xl transform rotate-20">你好</div>
          <div className="absolute bottom-8 left-4 sm:left-12 text-gray-300 opacity-30 text-lg sm:text-2xl transform rotate-35">Olá</div>
          <div className="absolute top-56 left-32 sm:left-64 text-gray-300 opacity-35 text-base sm:text-xl transform -rotate-25">Jambo</div>
          <div className="absolute bottom-56 right-12 sm:right-24 text-gray-300 opacity-40 text-lg sm:text-2xl transform rotate-50">Marhaba</div>
        </div>

        {/* Center content */}
        <div className="text-center z-10 max-w-md mx-auto">
          {/* Icon container with gradient background */}
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-xl rounded-full"></div>
            <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full p-6 shadow-lg">
              <Bird className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-gray-500" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-4">Translation App Not On</h2>

          <p className="text-gray-600 text-sm sm:text-base mb-6 px-4">
            The translation service is currently offline. Please start the app in MentraOS to begin translating.
          </p>

          <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-[12px] p-4 mx-4 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-gray-700 text-xs sm:text-sm">
              <Power className="w-4 h-4 text-[#2172F1]" />
              <span>Toggle the start button in MentraOS</span>
            </div>
          </div>
        </div>
      </div>
    )
}

export default TpaConnectionError
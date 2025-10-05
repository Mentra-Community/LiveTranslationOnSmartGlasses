import React from 'react'
import { Bird } from 'lucide-react'

  // A screen to show when the TPA server is not connected
function TpaConnectionError() {
  return (
    <div className="relative h-screen w-full bg-white overflow-hidden flex items-center justify-center">
        {/* Background words */}
        <div className="absolute inset-0 select-none pointer-events-none">
          <div className="absolute top-8 left-16 text-gray-300 opacity-50 text-2xl transform rotate-12">Hello</div>
          <div className="absolute top-24 right-12 text-gray-100 opacity-40 text-xl transform -rotate-6">Bonjour</div>
          <div className="absolute top-12 right-32 text-gray-300 opacity-45 text-2xl transform rotate-45">こんにちは</div>
          <div className="absolute top-48 left-8 text-gray-300 opacity-35 text-2xl transform -rotate-12">Hola</div>
          <div className="absolute bottom-32 right-16 text-gray-200 opacity-50 text-xl transform rotate-30">Guten Tag</div>
          <div className="absolute bottom-16 left-24 text-gray-300 opacity-40 text-2xl transform -rotate-20">Ciao</div>
          <div className="absolute top-64 right-48 text-gray-200 opacity-45 text-xl transform rotate-15">Привет</div>
          <div className="absolute bottom-48 left-48 text-gray-100 opacity-35 text-2xl transform -rotate-30">नमस्ते</div>
          <div className="absolute top-32 left-40 text-gray-100 opacity-40 text-xl transform rotate-60">Salaam</div>
          <div className="absolute bottom-24 right-40 text-gray-300 opacity-50 text-xl transform -rotate-45">Shalom</div>
          <div className="absolute top-4 right-64 text-gray-200 opacity-45 text-2xl transform rotate-20">你好</div>
          <div className="absolute bottom-8 left-12 text-gray-200 opacity-35 text-2xl transform rotate-35">Olá</div>
          <div className="absolute top-56 left-64 text-gray-100 opacity-40 text-xl transform -rotate-25">Jambo</div>
          <div className="absolute bottom-56 right-24 text-gray-100 opacity-50 text-2xl transform rotate-50">Marhaba</div>
        </div>

        {/* Center content */}
        <div className="text-center z-10">
          {/* Network connection icon */}
          <div className="mb-6">
              <Bird className="w-24 h-24 mx-auto text-gray-500" />
          </div>
          <h2 className="text-2xl font-medium text-gray-500 mb-2 text-bold">App Not Online</h2>
          <p className="text-gray-400 text-[10px] ">Please turn on the app by toggling the start button in MentraOS</p>
        </div>
      </div>
    )
}

export default TpaConnectionError
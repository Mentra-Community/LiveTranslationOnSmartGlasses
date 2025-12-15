import { ArmIcon } from "@/components/shape/ArmIcon";
import { SquareIcon } from "@/components/shape/SquareIcon";
import { Languages } from "lucide-react";
import { motion } from "framer-motion";
import React from "react";

function SplashScreen() {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center overflow-hidden relative">
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

      <div className="flex-1 flex justify-center items-center relative z-10">
        <div className="flex flex-row justify-center items-end scale-45 sm:scale-50 md:scale-75 lg:scale-100">
          <motion.div
            className="-mr-6 -mb-2"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 1.0, ease: [0.9, 0.1, 0.3, 1], delay: 0.2 }}
          >
            <SquareIcon className="w-24 h-24" />
          </motion.div>
          <motion.div
            className="-mr-7"
            initial={{ x: -100, y: -100, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ duration: 1.3, ease: [0.9, 0.1, 0.3, 1] }}
          >
            <ArmIcon className="" />
          </motion.div>
          <motion.div
            initial={{ x: 100, y: 100, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ duration: 1.3, ease: [0.9, 0.1, 0.3, 1] }}
          >
            <ArmIcon className="mr-[]" />
          </motion.div>
        </div>
      </div>

      <div className="text-gray-800 font-bold text-lg sm:text-xl md:text-2xl lg:text-3xl flex items-center gap-2 bg-white/80 backdrop-blur-sm mb-20 pl-[5px] pr-[5px] pt-[2px] pb-[2px] relative overflow-hidden border border-gray-200 rounded-full shadow-lg px-[10px] z-10">
        <motion.div
          className="absolute inset-0 bg-white/90 px-[10px]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1, ease: "easeInOut", delay: 0.3 }}
        />
        <Languages
          className="w-5 h-5 sm:w-7 sm:h-7 md:w-7 md:h-7 lg:w-9 lg:h-12 relative z-10 ml-1"
          style={{ stroke: "#216FF0" }}
        />
        <div className="flex flex-col text-xl sm:text-2xl md:text-3xl lg:text-4xl relative z-10">
          <span className="text-[#216FF0] mr-1">TRANSLATION</span>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;

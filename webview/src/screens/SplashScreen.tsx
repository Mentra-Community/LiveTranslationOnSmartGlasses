import { ArmIcon } from '@/components/shape/ArmIcon'
import { SquareIcon } from '@/components/shape/SquareIcon'
import { Languages } from 'lucide-react'
import { motion } from 'framer-motion'
import React from 'react'

function SplashScreen() {
  return (
    <div className='w-full h-full flex flex-col justify-center items-center overflow-hidden'>
        <div className='flex-1 flex justify-center items-center'>
            <div className="flex flex-row justify-center items-end scale-45 sm:scale-50 md:scale-75 lg:scale-100">
                <motion.div
                className='-mr-8'
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 1.0, ease: [0.9, 0.1, 0.3, 1], delay: 0.2 }}
                >
                <SquareIcon className='w-24 h-24' />
                </motion.div>
                <motion.div
                className='-mr-10'
                initial={{ x: -100, y: -100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 1.3, ease: [0.9, 0.1, 0.3, 1] }}
                >
                <ArmIcon className=''/>
                </motion.div>
                <motion.div
                initial={{ x: 100, y: 100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 1.3, ease: [0.9, 0.1, 0.3, 1] }}
                >
                <ArmIcon className='mr-[]' />
                </motion.div>
            </div>
        </div>
        


        <div className='text-white font-bold text-lg sm:text-xl md:text-2xl lg:text-3xl flex items-center gap-2 bg-white mb-20 pl-[5px] pr-[5px] pt-[2px] pb-[2px] relative overflow-hidden'>
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1, ease: "easeInOut", delay: 0.3 }}
            />
            <Languages className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 relative z-10" />
            <div className='flex flex-col text-xl sm:text-2xl md:text-3xl lg:text-4xl relative z-10'>
                <span>TRANSLATION</span>
            </div>


        </div>
        
    </div>
  )
}

export default SplashScreen
# Seashell's user runtime support libraries.
# Copyright (C) 2014 The Seashell Maintainers.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Lesser General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# See also 'ADDITIONAL TERMS' at the end of the included LICENSE file.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
cmake_minimum_required(VERSION 2.6)

add_library(seashell-rt seashell-runtime.cpp)
add_custom_target(seashell-runtime-racket-copy ALL
  COMMAND ${CMAKE_COMMAND} -E copy "${CMAKE_CURRENT_SOURCE_DIR}/seashell-runtime.rkt" "${CMAKE_CURRENT_BINARY_DIR}")

install(TARGETS seashell-rt ARCHIVE DESTINATION lib)
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/seashell-runtime.rkt" DESTINATION lib)

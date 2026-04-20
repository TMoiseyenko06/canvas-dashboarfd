const COLORS = [
  'border-blue-500',
  'border-green-500',
  'border-purple-500',
  'border-pink-500',
  'border-yellow-500',
  'border-orange-500',
  'border-teal-500',
  'border-red-500',
]

export function courseColor(index) {
  return COLORS[index % COLORS.length]
}

export const COURSE_BG = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-red-500',
]

export default function CourseCard({ course, index }) {
  const borderColor = COLORS[index % COLORS.length]

  const score = course.current_score ?? course.final_score
  const grade = course.current_grade ?? course.final_grade

  const scoreNum = score !== null && score !== undefined ? Number(score) : null
  const scoreColor =
    scoreNum === null ? 'text-gray-400' :
    scoreNum >= 90 ? 'text-green-600' :
    scoreNum >= 80 ? 'text-blue-600' :
    scoreNum >= 70 ? 'text-yellow-600' :
    'text-red-600'

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${borderColor} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{course.course_code}</p>
          <h3 className="font-semibold text-gray-800 mt-0.5 leading-snug">{course.name}</h3>
        </div>
        <div className="text-right ml-4">
          {scoreNum !== null ? (
            <>
              <p className={`text-2xl font-bold ${scoreColor}`}>{scoreNum.toFixed(1)}%</p>
              {grade && <p className="text-sm text-gray-500">{grade}</p>}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Grade N/A</p>
          )}
        </div>
      </div>

      {course.assignment_groups?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1 font-medium">Assignment Groups</p>
          <div className="flex flex-wrap gap-2">
            {course.assignment_groups.map(g => (
              <span key={g.id} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                {g.name}{g.group_weight != null ? ` (${g.group_weight}%)` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

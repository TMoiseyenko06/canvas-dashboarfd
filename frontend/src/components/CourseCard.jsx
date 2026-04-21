const COLORS = [
  'border-blue-500', 'border-green-500', 'border-purple-500', 'border-pink-500',
  'border-yellow-500', 'border-orange-500', 'border-teal-500', 'border-red-500',
]

export default function CourseCard({ course, index, onHide }) {
  const borderColor = COLORS[index % COLORS.length]

  const calcScore = course.calculated_score
  const canvasScore = course.current_score ?? course.final_score
  const canvasGrade = course.current_grade ?? course.final_grade
  const displayScore = calcScore ?? canvasScore
  const scoreNum = displayScore != null ? Number(displayScore) : null

  const scoreColor =
    scoreNum === null ? 'text-gray-400' :
    scoreNum >= 90 ? 'text-green-500' :
    scoreNum >= 80 ? 'text-blue-500' :
    scoreNum >= 70 ? 'text-yellow-500' :
    'text-red-500'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 ${borderColor} p-5 relative group`}>
      <button onClick={() => onHide(course.id)} title="Hide this course"
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="Hide course">✕</button>

      <div className="flex items-start justify-between pr-5">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{course.course_code}</p>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mt-0.5 leading-snug">{course.name}</h3>
        </div>
        <div className="text-right ml-4 shrink-0">
          {scoreNum !== null ? (
            <>
              <p className={`text-2xl font-bold ${scoreColor}`}>{scoreNum.toFixed(1)}%</p>
              {calcScore != null
                ? <p className="text-xs text-gray-400">earned so far</p>
                : canvasGrade ? <p className="text-sm text-gray-500 dark:text-gray-400">{canvasGrade}</p>
                : null}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Grade N/A</p>
          )}
        </div>
      </div>

      {calcScore != null && canvasScore != null && calcScore !== canvasScore && (
        <p className="text-xs text-gray-400 mt-1">
          Canvas reports {Number(canvasScore).toFixed(1)}%{canvasGrade ? ` (${canvasGrade})` : ''}
        </p>
      )}

      {course.assignment_groups?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Assignment Groups</p>
          <div className="flex flex-wrap gap-2">
            {course.assignment_groups.map(g => (
              <span key={g.id} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-0.5">
                {g.name}{g.group_weight != null ? ` (${g.group_weight}%)` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
